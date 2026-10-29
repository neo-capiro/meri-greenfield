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
var schema33 = { "type": "object", "properties": { "requestId": { "type": "string", "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, "prompt": { "type": "string", "minLength": 1, "maxLength": 1e5, "pattern": "\\S" }, "windowRequest": { "$ref": "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042" }, "skill": { "type": "object", "properties": { "skillId": { "anyOf": [{ "$ref": "#/$defs/Canonical_Canonical_skillId_31e12e8e_20420fe7" }, { "$comment": "Identities added at this version. Adding another one requires a new reviewed version of this file, never an edit to the closed 0.2.0 enum.", "type": "string", "enum": ["quick_skill.cited_report"] }] }, "skillVersion": { "$ref": "#/$defs/Canonical_Canonical_skillVersion_7e2af095_7b29e661" } }, "required": ["skillId", "skillVersion"], "additionalProperties": false }, "modelSelection": { "type": "object", "properties": { "provider": { "enum": ["bedrock", "claude-api"] }, "modelId": { "type": "string", "pattern": "^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$" }, "effort": { "anyOf": [{ "type": "null" }, { "type": "string", "enum": ["low", "medium", "high", "xhigh", "max"] }] } }, "required": ["provider", "modelId", "effort"], "additionalProperties": false }, "documentRevision": { "type": "object", "properties": { "artifactId": { "type": "string", "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, "versionId": { "type": "string", "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, "objectSha256": { "type": "string", "pattern": "^[0-9a-f]{64}$" } }, "required": ["artifactId", "versionId", "objectSha256"], "additionalProperties": false }, "uploads": { "type": "array", "minItems": 1, "maxItems": 8, "uniqueItems": true, "items": { "type": "object", "properties": { "uploadId": { "type": "string", "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, "sha256": { "type": "string", "pattern": "^[0-9a-f]{64}$" } }, "required": ["uploadId", "sha256"], "additionalProperties": false } }, "procedure": { "oneOf": [{ "type": "object", "properties": { "source": { "const": "firm" }, "recordId": { "type": "string", "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, "version": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 }, "manifestDigest": { "type": "string", "pattern": "^[a-f0-9]{64}$" } }, "required": ["source", "recordId", "version", "manifestDigest"], "additionalProperties": false }, { "type": "object", "properties": { "source": { "const": "builtin" }, "id": { "enum": ["briefing", "draft", "bill_analysis", "hearing_prep", "coalition_letter", "amendment_tracker"] }, "version": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 }, "manifestDigest": { "type": "string", "pattern": "^[a-f0-9]{64}$" } }, "required": ["source", "id", "version", "manifestDigest"], "additionalProperties": false }] }, "siteWorkflow": { "type": "object", "properties": { "siteId": { "type": "string", "pattern": "^[a-z][a-z0-9-]{1,63}$" }, "workflowId": { "type": "string", "pattern": "^[a-z][a-z0-9-]{1,63}$" }, "version": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 }, "manifestSha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" } }, "required": ["siteId", "workflowId", "version", "manifestSha256"], "additionalProperties": false }, "work": { "type": "object", "properties": { "entry": { "enum": ["start-work", "delegate"] }, "jobKind": { "enum": ["research", "deliverable", "audit", "scheduled"] }, "deliverables": { "type": "array", "maxItems": 20, "uniqueItems": true, "items": { "type": "string", "minLength": 1, "maxLength": 200, "pattern": "\\S" } }, "dependencies": { "type": "array", "maxItems": 20, "uniqueItems": true, "items": { "type": "string", "minLength": 1, "maxLength": 200, "pattern": "\\S" } } }, "required": ["entry", "jobKind", "deliverables", "dependencies"], "additionalProperties": false } }, "required": ["requestId", "prompt"], "additionalProperties": false, "not": { "properties": { "skill": {}, "procedure": {} }, "required": ["skill", "procedure"] }, "if": { "properties": { "skill": {}, "documentRevision": {} }, "required": ["skill", "documentRevision"] }, "then": { "properties": { "skill": { "anyOf": [{ "type": "object", "properties": { "skillId": { "const": "quick_skill.bill_watch" }, "skillVersion": { "const": "2.0.0" } }, "required": ["skillId", "skillVersion"] }, { "type": "object", "properties": { "skillId": { "const": "quick_skill.cited_report" }, "skillVersion": { "const": "1.0.0" } }, "required": ["skillId", "skillVersion"] }] } } } };
var schema34 = { "oneOf": [{ "type": "object", "properties": { "basis": { "const": "calendar-week" }, "offset": { "type": "integer", "enum": [-1, 0] }, "timezone": { "type": "string", "minLength": 1, "maxLength": 100 }, "weekStartsOn": { "type": "string", "enum": ["monday", "sunday"] } }, "required": ["basis", "offset", "timezone", "weekStartsOn"], "additionalProperties": false }, { "type": "object", "properties": { "basis": { "const": "calendar-month" }, "offset": { "type": "integer", "enum": [-1, 0] }, "timezone": { "type": "string", "minLength": 1, "maxLength": 100 } }, "required": ["basis", "offset", "timezone"], "additionalProperties": false }, { "type": "object", "properties": { "basis": { "const": "calendar-year" }, "offset": { "type": "integer", "enum": [-1, 0] }, "timezone": { "type": "string", "minLength": 1, "maxLength": 100 } }, "required": ["basis", "offset", "timezone"], "additionalProperties": false }, { "type": "object", "properties": { "basis": { "const": "relative-duration" }, "days": { "type": "integer", "minimum": 1, "maximum": 3660 }, "anchorAt": { "type": "string", "format": "date-time", "pattern": "Z$" }, "timezone": { "type": "string", "minLength": 1, "maxLength": 100 } }, "required": ["basis", "days", "anchorAt", "timezone"], "additionalProperties": false }, { "type": "object", "properties": { "basis": { "const": "explicit" }, "startInclusive": { "type": "string", "format": "date-time", "pattern": "Z$" }, "endExclusive": { "type": "string", "format": "date-time", "pattern": "Z$" }, "timezone": { "type": "string", "minLength": 1, "maxLength": 100 } }, "required": ["basis", "startInclusive", "endExclusive", "timezone"], "additionalProperties": false }, { "type": "object", "properties": { "basis": { "const": "fiscal-year" }, "year": { "type": "integer", "minimum": 1900, "maximum": 3e3 }, "calendarId": { "type": "string", "minLength": 1, "maxLength": 128, "pattern": "^[a-z][a-z0-9_.-]*$" }, "stage": { "type": "string", "enum": ["requested", "authorized", "appropriated", "obligated", "actual", "outlay"] }, "revisionId": { "type": "string", "minLength": 1, "maxLength": 256 }, "timezone": { "type": "string", "minLength": 1, "maxLength": 100 } }, "required": ["basis", "year", "calendarId", "stage", "revisionId", "timezone"], "additionalProperties": false }, { "type": "object", "properties": { "basis": { "const": "unbounded" } }, "required": ["basis"], "additionalProperties": false }] };
var schema35 = { "type": "string", "enum": ["quick_skill.research_company", "quick_skill.relationship_brief", "quick_skill.client_changes", "quick_skill.portfolio_changes", "quick_skill.portfolio_overlap", "quick_skill.mail_history", "quick_skill.meeting_prep", "quick_skill.commitments_audit", "quick_skill.funding_opportunity_match", "quick_skill.pe_deep_dive", "quick_skill.bill_watch", "quick_skill.hearing_watch", "quick_skill.representation_lookup", "quick_skill.regulatory_docket_brief"] };
var func1 = Object.prototype.hasOwnProperty;
var func2 = require_ucs2length().default;
var func0 = require_equal().default;
var pattern4 = new RegExp("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", "u");
var pattern5 = new RegExp("\\S", "u");
var pattern6 = new RegExp("Z$", "u");
var pattern9 = new RegExp("^[a-z][a-z0-9_.-]*$", "u");
var pattern10 = new RegExp("^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)$", "u");
var pattern11 = new RegExp("^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$", "u");
var pattern14 = new RegExp("^[0-9a-f]{64}$", "u");
var pattern18 = new RegExp("^[a-f0-9]{64}$", "u");
var pattern20 = new RegExp("^[a-z][a-z0-9-]{1,63}$", "u");
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
  const _errs1 = errors2;
  const _errs2 = errors2;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    let missing0;
    if (data.skill === void 0 && (missing0 = "skill") || data.procedure === void 0 && (missing0 = "procedure")) {
      const err0 = {};
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors2++;
    }
  }
  var valid0 = _errs2 === errors2;
  if (valid0) {
    validate39.errors = [{ instancePath, schemaPath: "#/not", keyword: "not", params: {}, message: "must NOT be valid" }];
    return false;
  } else {
    errors2 = _errs1;
    if (vErrors !== null) {
      if (_errs1) {
        vErrors.length = _errs1;
      } else {
        vErrors = null;
      }
    }
    const _errs3 = errors2;
    let valid1 = true;
    const _errs4 = errors2;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing1;
      if (data.skill === void 0 && (missing1 = "skill") || data.documentRevision === void 0 && (missing1 = "documentRevision")) {
        const err1 = {};
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors2++;
      }
    }
    var _valid0 = _errs4 === errors2;
    errors2 = _errs3;
    if (vErrors !== null) {
      if (_errs3) {
        vErrors.length = _errs3;
      } else {
        vErrors = null;
      }
    }
    if (_valid0) {
      const _errs5 = errors2;
      if (data && typeof data == "object" && !Array.isArray(data)) {
        if (data.skill !== void 0) {
          let data0 = data.skill;
          const _errs7 = errors2;
          let valid3 = false;
          const _errs8 = errors2;
          if (errors2 === _errs8) {
            if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
              let missing2;
              if (data0.skillId === void 0 && (missing2 = "skillId") || data0.skillVersion === void 0 && (missing2 = "skillVersion")) {
                const err2 = { instancePath: instancePath + "/skill", schemaPath: "#/then/properties/skill/anyOf/0/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" };
                if (vErrors === null) {
                  vErrors = [err2];
                } else {
                  vErrors.push(err2);
                }
                errors2++;
              } else {
                if (data0.skillId !== void 0) {
                  const _errs10 = errors2;
                  if ("quick_skill.bill_watch" !== data0.skillId) {
                    const err3 = { instancePath: instancePath + "/skill/skillId", schemaPath: "#/then/properties/skill/anyOf/0/properties/skillId/const", keyword: "const", params: { allowedValue: "quick_skill.bill_watch" }, message: "must be equal to constant" };
                    if (vErrors === null) {
                      vErrors = [err3];
                    } else {
                      vErrors.push(err3);
                    }
                    errors2++;
                  }
                  var valid4 = _errs10 === errors2;
                } else {
                  var valid4 = true;
                }
                if (valid4) {
                  if (data0.skillVersion !== void 0) {
                    const _errs11 = errors2;
                    if ("2.0.0" !== data0.skillVersion) {
                      const err4 = { instancePath: instancePath + "/skill/skillVersion", schemaPath: "#/then/properties/skill/anyOf/0/properties/skillVersion/const", keyword: "const", params: { allowedValue: "2.0.0" }, message: "must be equal to constant" };
                      if (vErrors === null) {
                        vErrors = [err4];
                      } else {
                        vErrors.push(err4);
                      }
                      errors2++;
                    }
                    var valid4 = _errs11 === errors2;
                  } else {
                    var valid4 = true;
                  }
                }
              }
            } else {
              const err5 = { instancePath: instancePath + "/skill", schemaPath: "#/then/properties/skill/anyOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
              if (vErrors === null) {
                vErrors = [err5];
              } else {
                vErrors.push(err5);
              }
              errors2++;
            }
          }
          var _valid1 = _errs8 === errors2;
          valid3 = valid3 || _valid1;
          if (_valid1) {
            var props0 = {};
            props0.skillId = true;
            props0.skillVersion = true;
          }
          const _errs12 = errors2;
          if (errors2 === _errs12) {
            if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
              let missing3;
              if (data0.skillId === void 0 && (missing3 = "skillId") || data0.skillVersion === void 0 && (missing3 = "skillVersion")) {
                const err6 = { instancePath: instancePath + "/skill", schemaPath: "#/then/properties/skill/anyOf/1/required", keyword: "required", params: { missingProperty: missing3 }, message: "must have required property '" + missing3 + "'" };
                if (vErrors === null) {
                  vErrors = [err6];
                } else {
                  vErrors.push(err6);
                }
                errors2++;
              } else {
                if (data0.skillId !== void 0) {
                  const _errs14 = errors2;
                  if ("quick_skill.cited_report" !== data0.skillId) {
                    const err7 = { instancePath: instancePath + "/skill/skillId", schemaPath: "#/then/properties/skill/anyOf/1/properties/skillId/const", keyword: "const", params: { allowedValue: "quick_skill.cited_report" }, message: "must be equal to constant" };
                    if (vErrors === null) {
                      vErrors = [err7];
                    } else {
                      vErrors.push(err7);
                    }
                    errors2++;
                  }
                  var valid5 = _errs14 === errors2;
                } else {
                  var valid5 = true;
                }
                if (valid5) {
                  if (data0.skillVersion !== void 0) {
                    const _errs15 = errors2;
                    if ("1.0.0" !== data0.skillVersion) {
                      const err8 = { instancePath: instancePath + "/skill/skillVersion", schemaPath: "#/then/properties/skill/anyOf/1/properties/skillVersion/const", keyword: "const", params: { allowedValue: "1.0.0" }, message: "must be equal to constant" };
                      if (vErrors === null) {
                        vErrors = [err8];
                      } else {
                        vErrors.push(err8);
                      }
                      errors2++;
                    }
                    var valid5 = _errs15 === errors2;
                  } else {
                    var valid5 = true;
                  }
                }
              }
            } else {
              const err9 = { instancePath: instancePath + "/skill", schemaPath: "#/then/properties/skill/anyOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
              if (vErrors === null) {
                vErrors = [err9];
              } else {
                vErrors.push(err9);
              }
              errors2++;
            }
          }
          var _valid1 = _errs12 === errors2;
          valid3 = valid3 || _valid1;
          if (_valid1) {
            if (props0 !== true) {
              props0 = props0 || {};
              props0.skillId = true;
              props0.skillVersion = true;
            }
          }
          if (!valid3) {
            const err10 = { instancePath: instancePath + "/skill", schemaPath: "#/then/properties/skill/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
            if (vErrors === null) {
              vErrors = [err10];
            } else {
              vErrors.push(err10);
            }
            errors2++;
            validate39.errors = vErrors;
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
        }
      }
      var _valid0 = _errs5 === errors2;
      valid1 = _valid0;
      if (valid1) {
        var props1 = {};
        props1.skill = true;
        props1.documentRevision = true;
      }
    }
    if (!valid1) {
      const err11 = { instancePath, schemaPath: "#/if", keyword: "if", params: { failingKeyword: "then" }, message: 'must match "then" schema' };
      if (vErrors === null) {
        vErrors = [err11];
      } else {
        vErrors.push(err11);
      }
      errors2++;
      validate39.errors = vErrors;
      return false;
    }
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing4;
      if (data.requestId === void 0 && (missing4 = "requestId") || data.prompt === void 0 && (missing4 = "prompt")) {
        validate39.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing4 }, message: "must have required property '" + missing4 + "'" }];
        return false;
      } else {
        const _errs16 = errors2;
        for (const key0 in data) {
          if (!func1.call(schema33.properties, key0)) {
            validate39.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs16 === errors2) {
          if (data.requestId !== void 0) {
            let data5 = data.requestId;
            const _errs17 = errors2;
            if (errors2 === _errs17) {
              if (typeof data5 === "string") {
                if (!pattern4.test(data5)) {
                  validate39.errors = [{ instancePath: instancePath + "/requestId", schemaPath: "#/properties/requestId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' }];
                  return false;
                }
              } else {
                validate39.errors = [{ instancePath: instancePath + "/requestId", schemaPath: "#/properties/requestId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid6 = _errs17 === errors2;
          } else {
            var valid6 = true;
          }
          if (valid6) {
            if (data.prompt !== void 0) {
              let data6 = data.prompt;
              const _errs19 = errors2;
              if (errors2 === _errs19) {
                if (typeof data6 === "string") {
                  if (func2(data6) > 1e5) {
                    validate39.errors = [{ instancePath: instancePath + "/prompt", schemaPath: "#/properties/prompt/maxLength", keyword: "maxLength", params: { limit: 1e5 }, message: "must NOT have more than 100000 characters" }];
                    return false;
                  } else {
                    if (func2(data6) < 1) {
                      validate39.errors = [{ instancePath: instancePath + "/prompt", schemaPath: "#/properties/prompt/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                      return false;
                    } else {
                      if (!pattern5.test(data6)) {
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
              var valid6 = _errs19 === errors2;
            } else {
              var valid6 = true;
            }
            if (valid6) {
              if (data.windowRequest !== void 0) {
                let data7 = data.windowRequest;
                const _errs21 = errors2;
                const _errs23 = errors2;
                let valid8 = false;
                let passing0 = null;
                const _errs24 = errors2;
                if (errors2 === _errs24) {
                  if (data7 && typeof data7 == "object" && !Array.isArray(data7)) {
                    let missing5;
                    if (data7.basis === void 0 && (missing5 = "basis") || data7.offset === void 0 && (missing5 = "offset") || data7.timezone === void 0 && (missing5 = "timezone") || data7.weekStartsOn === void 0 && (missing5 = "weekStartsOn")) {
                      const err12 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/0/required", keyword: "required", params: { missingProperty: missing5 }, message: "must have required property '" + missing5 + "'" };
                      if (vErrors === null) {
                        vErrors = [err12];
                      } else {
                        vErrors.push(err12);
                      }
                      errors2++;
                    } else {
                      const _errs26 = errors2;
                      for (const key1 in data7) {
                        if (!(key1 === "basis" || key1 === "offset" || key1 === "timezone" || key1 === "weekStartsOn")) {
                          const err13 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
                          if (vErrors === null) {
                            vErrors = [err13];
                          } else {
                            vErrors.push(err13);
                          }
                          errors2++;
                          break;
                        }
                      }
                      if (_errs26 === errors2) {
                        if (data7.basis !== void 0) {
                          const _errs27 = errors2;
                          if ("calendar-week" !== data7.basis) {
                            const err14 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/0/properties/basis/const", keyword: "const", params: { allowedValue: "calendar-week" }, message: "must be equal to constant" };
                            if (vErrors === null) {
                              vErrors = [err14];
                            } else {
                              vErrors.push(err14);
                            }
                            errors2++;
                          }
                          var valid9 = _errs27 === errors2;
                        } else {
                          var valid9 = true;
                        }
                        if (valid9) {
                          if (data7.offset !== void 0) {
                            let data9 = data7.offset;
                            const _errs28 = errors2;
                            if (!(typeof data9 == "number" && (!(data9 % 1) && !isNaN(data9)) && isFinite(data9))) {
                              const err15 = { instancePath: instancePath + "/windowRequest/offset", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/0/properties/offset/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                              if (vErrors === null) {
                                vErrors = [err15];
                              } else {
                                vErrors.push(err15);
                              }
                              errors2++;
                            }
                            if (!(data9 === -1 || data9 === 0)) {
                              const err16 = { instancePath: instancePath + "/windowRequest/offset", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/0/properties/offset/enum", keyword: "enum", params: { allowedValues: schema34.oneOf[0].properties.offset.enum }, message: "must be equal to one of the allowed values" };
                              if (vErrors === null) {
                                vErrors = [err16];
                              } else {
                                vErrors.push(err16);
                              }
                              errors2++;
                            }
                            var valid9 = _errs28 === errors2;
                          } else {
                            var valid9 = true;
                          }
                          if (valid9) {
                            if (data7.timezone !== void 0) {
                              let data10 = data7.timezone;
                              const _errs30 = errors2;
                              if (errors2 === _errs30) {
                                if (typeof data10 === "string") {
                                  if (func2(data10) > 100) {
                                    const err17 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/0/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                    if (vErrors === null) {
                                      vErrors = [err17];
                                    } else {
                                      vErrors.push(err17);
                                    }
                                    errors2++;
                                  } else {
                                    if (func2(data10) < 1) {
                                      const err18 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/0/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                      if (vErrors === null) {
                                        vErrors = [err18];
                                      } else {
                                        vErrors.push(err18);
                                      }
                                      errors2++;
                                    }
                                  }
                                } else {
                                  const err19 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/0/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                  if (vErrors === null) {
                                    vErrors = [err19];
                                  } else {
                                    vErrors.push(err19);
                                  }
                                  errors2++;
                                }
                              }
                              var valid9 = _errs30 === errors2;
                            } else {
                              var valid9 = true;
                            }
                            if (valid9) {
                              if (data7.weekStartsOn !== void 0) {
                                let data11 = data7.weekStartsOn;
                                const _errs32 = errors2;
                                if (typeof data11 !== "string") {
                                  const err20 = { instancePath: instancePath + "/windowRequest/weekStartsOn", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/0/properties/weekStartsOn/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                  if (vErrors === null) {
                                    vErrors = [err20];
                                  } else {
                                    vErrors.push(err20);
                                  }
                                  errors2++;
                                }
                                if (!(data11 === "monday" || data11 === "sunday")) {
                                  const err21 = { instancePath: instancePath + "/windowRequest/weekStartsOn", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/0/properties/weekStartsOn/enum", keyword: "enum", params: { allowedValues: schema34.oneOf[0].properties.weekStartsOn.enum }, message: "must be equal to one of the allowed values" };
                                  if (vErrors === null) {
                                    vErrors = [err21];
                                  } else {
                                    vErrors.push(err21);
                                  }
                                  errors2++;
                                }
                                var valid9 = _errs32 === errors2;
                              } else {
                                var valid9 = true;
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    const err22 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                    if (vErrors === null) {
                      vErrors = [err22];
                    } else {
                      vErrors.push(err22);
                    }
                    errors2++;
                  }
                }
                var _valid2 = _errs24 === errors2;
                if (_valid2) {
                  valid8 = true;
                  passing0 = 0;
                  var props2 = true;
                }
                const _errs34 = errors2;
                if (errors2 === _errs34) {
                  if (data7 && typeof data7 == "object" && !Array.isArray(data7)) {
                    let missing6;
                    if (data7.basis === void 0 && (missing6 = "basis") || data7.offset === void 0 && (missing6 = "offset") || data7.timezone === void 0 && (missing6 = "timezone")) {
                      const err23 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/1/required", keyword: "required", params: { missingProperty: missing6 }, message: "must have required property '" + missing6 + "'" };
                      if (vErrors === null) {
                        vErrors = [err23];
                      } else {
                        vErrors.push(err23);
                      }
                      errors2++;
                    } else {
                      const _errs36 = errors2;
                      for (const key2 in data7) {
                        if (!(key2 === "basis" || key2 === "offset" || key2 === "timezone")) {
                          const err24 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
                          if (vErrors === null) {
                            vErrors = [err24];
                          } else {
                            vErrors.push(err24);
                          }
                          errors2++;
                          break;
                        }
                      }
                      if (_errs36 === errors2) {
                        if (data7.basis !== void 0) {
                          const _errs37 = errors2;
                          if ("calendar-month" !== data7.basis) {
                            const err25 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/1/properties/basis/const", keyword: "const", params: { allowedValue: "calendar-month" }, message: "must be equal to constant" };
                            if (vErrors === null) {
                              vErrors = [err25];
                            } else {
                              vErrors.push(err25);
                            }
                            errors2++;
                          }
                          var valid10 = _errs37 === errors2;
                        } else {
                          var valid10 = true;
                        }
                        if (valid10) {
                          if (data7.offset !== void 0) {
                            let data13 = data7.offset;
                            const _errs38 = errors2;
                            if (!(typeof data13 == "number" && (!(data13 % 1) && !isNaN(data13)) && isFinite(data13))) {
                              const err26 = { instancePath: instancePath + "/windowRequest/offset", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/1/properties/offset/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                              if (vErrors === null) {
                                vErrors = [err26];
                              } else {
                                vErrors.push(err26);
                              }
                              errors2++;
                            }
                            if (!(data13 === -1 || data13 === 0)) {
                              const err27 = { instancePath: instancePath + "/windowRequest/offset", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/1/properties/offset/enum", keyword: "enum", params: { allowedValues: schema34.oneOf[1].properties.offset.enum }, message: "must be equal to one of the allowed values" };
                              if (vErrors === null) {
                                vErrors = [err27];
                              } else {
                                vErrors.push(err27);
                              }
                              errors2++;
                            }
                            var valid10 = _errs38 === errors2;
                          } else {
                            var valid10 = true;
                          }
                          if (valid10) {
                            if (data7.timezone !== void 0) {
                              let data14 = data7.timezone;
                              const _errs40 = errors2;
                              if (errors2 === _errs40) {
                                if (typeof data14 === "string") {
                                  if (func2(data14) > 100) {
                                    const err28 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/1/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                    if (vErrors === null) {
                                      vErrors = [err28];
                                    } else {
                                      vErrors.push(err28);
                                    }
                                    errors2++;
                                  } else {
                                    if (func2(data14) < 1) {
                                      const err29 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/1/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                      if (vErrors === null) {
                                        vErrors = [err29];
                                      } else {
                                        vErrors.push(err29);
                                      }
                                      errors2++;
                                    }
                                  }
                                } else {
                                  const err30 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/1/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                  if (vErrors === null) {
                                    vErrors = [err30];
                                  } else {
                                    vErrors.push(err30);
                                  }
                                  errors2++;
                                }
                              }
                              var valid10 = _errs40 === errors2;
                            } else {
                              var valid10 = true;
                            }
                          }
                        }
                      }
                    }
                  } else {
                    const err31 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                    if (vErrors === null) {
                      vErrors = [err31];
                    } else {
                      vErrors.push(err31);
                    }
                    errors2++;
                  }
                }
                var _valid2 = _errs34 === errors2;
                if (_valid2 && valid8) {
                  valid8 = false;
                  passing0 = [passing0, 1];
                } else {
                  if (_valid2) {
                    valid8 = true;
                    passing0 = 1;
                    if (props2 !== true) {
                      props2 = true;
                    }
                  }
                  const _errs42 = errors2;
                  if (errors2 === _errs42) {
                    if (data7 && typeof data7 == "object" && !Array.isArray(data7)) {
                      let missing7;
                      if (data7.basis === void 0 && (missing7 = "basis") || data7.offset === void 0 && (missing7 = "offset") || data7.timezone === void 0 && (missing7 = "timezone")) {
                        const err32 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/2/required", keyword: "required", params: { missingProperty: missing7 }, message: "must have required property '" + missing7 + "'" };
                        if (vErrors === null) {
                          vErrors = [err32];
                        } else {
                          vErrors.push(err32);
                        }
                        errors2++;
                      } else {
                        const _errs44 = errors2;
                        for (const key3 in data7) {
                          if (!(key3 === "basis" || key3 === "offset" || key3 === "timezone")) {
                            const err33 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/2/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" };
                            if (vErrors === null) {
                              vErrors = [err33];
                            } else {
                              vErrors.push(err33);
                            }
                            errors2++;
                            break;
                          }
                        }
                        if (_errs44 === errors2) {
                          if (data7.basis !== void 0) {
                            const _errs45 = errors2;
                            if ("calendar-year" !== data7.basis) {
                              const err34 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/2/properties/basis/const", keyword: "const", params: { allowedValue: "calendar-year" }, message: "must be equal to constant" };
                              if (vErrors === null) {
                                vErrors = [err34];
                              } else {
                                vErrors.push(err34);
                              }
                              errors2++;
                            }
                            var valid11 = _errs45 === errors2;
                          } else {
                            var valid11 = true;
                          }
                          if (valid11) {
                            if (data7.offset !== void 0) {
                              let data16 = data7.offset;
                              const _errs46 = errors2;
                              if (!(typeof data16 == "number" && (!(data16 % 1) && !isNaN(data16)) && isFinite(data16))) {
                                const err35 = { instancePath: instancePath + "/windowRequest/offset", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/2/properties/offset/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                if (vErrors === null) {
                                  vErrors = [err35];
                                } else {
                                  vErrors.push(err35);
                                }
                                errors2++;
                              }
                              if (!(data16 === -1 || data16 === 0)) {
                                const err36 = { instancePath: instancePath + "/windowRequest/offset", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/2/properties/offset/enum", keyword: "enum", params: { allowedValues: schema34.oneOf[2].properties.offset.enum }, message: "must be equal to one of the allowed values" };
                                if (vErrors === null) {
                                  vErrors = [err36];
                                } else {
                                  vErrors.push(err36);
                                }
                                errors2++;
                              }
                              var valid11 = _errs46 === errors2;
                            } else {
                              var valid11 = true;
                            }
                            if (valid11) {
                              if (data7.timezone !== void 0) {
                                let data17 = data7.timezone;
                                const _errs48 = errors2;
                                if (errors2 === _errs48) {
                                  if (typeof data17 === "string") {
                                    if (func2(data17) > 100) {
                                      const err37 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/2/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                      if (vErrors === null) {
                                        vErrors = [err37];
                                      } else {
                                        vErrors.push(err37);
                                      }
                                      errors2++;
                                    } else {
                                      if (func2(data17) < 1) {
                                        const err38 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/2/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                        if (vErrors === null) {
                                          vErrors = [err38];
                                        } else {
                                          vErrors.push(err38);
                                        }
                                        errors2++;
                                      }
                                    }
                                  } else {
                                    const err39 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/2/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                    if (vErrors === null) {
                                      vErrors = [err39];
                                    } else {
                                      vErrors.push(err39);
                                    }
                                    errors2++;
                                  }
                                }
                                var valid11 = _errs48 === errors2;
                              } else {
                                var valid11 = true;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      const err40 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/2/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                      if (vErrors === null) {
                        vErrors = [err40];
                      } else {
                        vErrors.push(err40);
                      }
                      errors2++;
                    }
                  }
                  var _valid2 = _errs42 === errors2;
                  if (_valid2 && valid8) {
                    valid8 = false;
                    passing0 = [passing0, 2];
                  } else {
                    if (_valid2) {
                      valid8 = true;
                      passing0 = 2;
                      if (props2 !== true) {
                        props2 = true;
                      }
                    }
                    const _errs50 = errors2;
                    if (errors2 === _errs50) {
                      if (data7 && typeof data7 == "object" && !Array.isArray(data7)) {
                        let missing8;
                        if (data7.basis === void 0 && (missing8 = "basis") || data7.days === void 0 && (missing8 = "days") || data7.anchorAt === void 0 && (missing8 = "anchorAt") || data7.timezone === void 0 && (missing8 = "timezone")) {
                          const err41 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/3/required", keyword: "required", params: { missingProperty: missing8 }, message: "must have required property '" + missing8 + "'" };
                          if (vErrors === null) {
                            vErrors = [err41];
                          } else {
                            vErrors.push(err41);
                          }
                          errors2++;
                        } else {
                          const _errs52 = errors2;
                          for (const key4 in data7) {
                            if (!(key4 === "basis" || key4 === "days" || key4 === "anchorAt" || key4 === "timezone")) {
                              const err42 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/3/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key4 }, message: "must NOT have additional properties" };
                              if (vErrors === null) {
                                vErrors = [err42];
                              } else {
                                vErrors.push(err42);
                              }
                              errors2++;
                              break;
                            }
                          }
                          if (_errs52 === errors2) {
                            if (data7.basis !== void 0) {
                              const _errs53 = errors2;
                              if ("relative-duration" !== data7.basis) {
                                const err43 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/3/properties/basis/const", keyword: "const", params: { allowedValue: "relative-duration" }, message: "must be equal to constant" };
                                if (vErrors === null) {
                                  vErrors = [err43];
                                } else {
                                  vErrors.push(err43);
                                }
                                errors2++;
                              }
                              var valid12 = _errs53 === errors2;
                            } else {
                              var valid12 = true;
                            }
                            if (valid12) {
                              if (data7.days !== void 0) {
                                let data19 = data7.days;
                                const _errs54 = errors2;
                                if (!(typeof data19 == "number" && (!(data19 % 1) && !isNaN(data19)) && isFinite(data19))) {
                                  const err44 = { instancePath: instancePath + "/windowRequest/days", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/3/properties/days/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                  if (vErrors === null) {
                                    vErrors = [err44];
                                  } else {
                                    vErrors.push(err44);
                                  }
                                  errors2++;
                                }
                                if (errors2 === _errs54) {
                                  if (typeof data19 == "number" && isFinite(data19)) {
                                    if (data19 > 3660 || isNaN(data19)) {
                                      const err45 = { instancePath: instancePath + "/windowRequest/days", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/3/properties/days/maximum", keyword: "maximum", params: { comparison: "<=", limit: 3660 }, message: "must be <= 3660" };
                                      if (vErrors === null) {
                                        vErrors = [err45];
                                      } else {
                                        vErrors.push(err45);
                                      }
                                      errors2++;
                                    } else {
                                      if (data19 < 1 || isNaN(data19)) {
                                        const err46 = { instancePath: instancePath + "/windowRequest/days", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/3/properties/days/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
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
                                var valid12 = _errs54 === errors2;
                              } else {
                                var valid12 = true;
                              }
                              if (valid12) {
                                if (data7.anchorAt !== void 0) {
                                  let data20 = data7.anchorAt;
                                  const _errs56 = errors2;
                                  if (errors2 === _errs56) {
                                    if (errors2 === _errs56) {
                                      if (typeof data20 === "string") {
                                        if (!pattern6.test(data20)) {
                                          const err47 = { instancePath: instancePath + "/windowRequest/anchorAt", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/3/properties/anchorAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                                          if (vErrors === null) {
                                            vErrors = [err47];
                                          } else {
                                            vErrors.push(err47);
                                          }
                                          errors2++;
                                        } else {
                                          if (!formats0.validate(data20)) {
                                            const err48 = { instancePath: instancePath + "/windowRequest/anchorAt", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/3/properties/anchorAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                            if (vErrors === null) {
                                              vErrors = [err48];
                                            } else {
                                              vErrors.push(err48);
                                            }
                                            errors2++;
                                          }
                                        }
                                      } else {
                                        const err49 = { instancePath: instancePath + "/windowRequest/anchorAt", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/3/properties/anchorAt/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                        if (vErrors === null) {
                                          vErrors = [err49];
                                        } else {
                                          vErrors.push(err49);
                                        }
                                        errors2++;
                                      }
                                    }
                                  }
                                  var valid12 = _errs56 === errors2;
                                } else {
                                  var valid12 = true;
                                }
                                if (valid12) {
                                  if (data7.timezone !== void 0) {
                                    let data21 = data7.timezone;
                                    const _errs58 = errors2;
                                    if (errors2 === _errs58) {
                                      if (typeof data21 === "string") {
                                        if (func2(data21) > 100) {
                                          const err50 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/3/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                          if (vErrors === null) {
                                            vErrors = [err50];
                                          } else {
                                            vErrors.push(err50);
                                          }
                                          errors2++;
                                        } else {
                                          if (func2(data21) < 1) {
                                            const err51 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/3/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                            if (vErrors === null) {
                                              vErrors = [err51];
                                            } else {
                                              vErrors.push(err51);
                                            }
                                            errors2++;
                                          }
                                        }
                                      } else {
                                        const err52 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/3/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                        if (vErrors === null) {
                                          vErrors = [err52];
                                        } else {
                                          vErrors.push(err52);
                                        }
                                        errors2++;
                                      }
                                    }
                                    var valid12 = _errs58 === errors2;
                                  } else {
                                    var valid12 = true;
                                  }
                                }
                              }
                            }
                          }
                        }
                      } else {
                        const err53 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/3/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                        if (vErrors === null) {
                          vErrors = [err53];
                        } else {
                          vErrors.push(err53);
                        }
                        errors2++;
                      }
                    }
                    var _valid2 = _errs50 === errors2;
                    if (_valid2 && valid8) {
                      valid8 = false;
                      passing0 = [passing0, 3];
                    } else {
                      if (_valid2) {
                        valid8 = true;
                        passing0 = 3;
                        if (props2 !== true) {
                          props2 = true;
                        }
                      }
                      const _errs60 = errors2;
                      if (errors2 === _errs60) {
                        if (data7 && typeof data7 == "object" && !Array.isArray(data7)) {
                          let missing9;
                          if (data7.basis === void 0 && (missing9 = "basis") || data7.startInclusive === void 0 && (missing9 = "startInclusive") || data7.endExclusive === void 0 && (missing9 = "endExclusive") || data7.timezone === void 0 && (missing9 = "timezone")) {
                            const err54 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/4/required", keyword: "required", params: { missingProperty: missing9 }, message: "must have required property '" + missing9 + "'" };
                            if (vErrors === null) {
                              vErrors = [err54];
                            } else {
                              vErrors.push(err54);
                            }
                            errors2++;
                          } else {
                            const _errs62 = errors2;
                            for (const key5 in data7) {
                              if (!(key5 === "basis" || key5 === "startInclusive" || key5 === "endExclusive" || key5 === "timezone")) {
                                const err55 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/4/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key5 }, message: "must NOT have additional properties" };
                                if (vErrors === null) {
                                  vErrors = [err55];
                                } else {
                                  vErrors.push(err55);
                                }
                                errors2++;
                                break;
                              }
                            }
                            if (_errs62 === errors2) {
                              if (data7.basis !== void 0) {
                                const _errs63 = errors2;
                                if ("explicit" !== data7.basis) {
                                  const err56 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/4/properties/basis/const", keyword: "const", params: { allowedValue: "explicit" }, message: "must be equal to constant" };
                                  if (vErrors === null) {
                                    vErrors = [err56];
                                  } else {
                                    vErrors.push(err56);
                                  }
                                  errors2++;
                                }
                                var valid13 = _errs63 === errors2;
                              } else {
                                var valid13 = true;
                              }
                              if (valid13) {
                                if (data7.startInclusive !== void 0) {
                                  let data23 = data7.startInclusive;
                                  const _errs64 = errors2;
                                  if (errors2 === _errs64) {
                                    if (errors2 === _errs64) {
                                      if (typeof data23 === "string") {
                                        if (!pattern6.test(data23)) {
                                          const err57 = { instancePath: instancePath + "/windowRequest/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/4/properties/startInclusive/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                                          if (vErrors === null) {
                                            vErrors = [err57];
                                          } else {
                                            vErrors.push(err57);
                                          }
                                          errors2++;
                                        } else {
                                          if (!formats0.validate(data23)) {
                                            const err58 = { instancePath: instancePath + "/windowRequest/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/4/properties/startInclusive/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                            if (vErrors === null) {
                                              vErrors = [err58];
                                            } else {
                                              vErrors.push(err58);
                                            }
                                            errors2++;
                                          }
                                        }
                                      } else {
                                        const err59 = { instancePath: instancePath + "/windowRequest/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/4/properties/startInclusive/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                        if (vErrors === null) {
                                          vErrors = [err59];
                                        } else {
                                          vErrors.push(err59);
                                        }
                                        errors2++;
                                      }
                                    }
                                  }
                                  var valid13 = _errs64 === errors2;
                                } else {
                                  var valid13 = true;
                                }
                                if (valid13) {
                                  if (data7.endExclusive !== void 0) {
                                    let data24 = data7.endExclusive;
                                    const _errs66 = errors2;
                                    if (errors2 === _errs66) {
                                      if (errors2 === _errs66) {
                                        if (typeof data24 === "string") {
                                          if (!pattern6.test(data24)) {
                                            const err60 = { instancePath: instancePath + "/windowRequest/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/4/properties/endExclusive/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                                            if (vErrors === null) {
                                              vErrors = [err60];
                                            } else {
                                              vErrors.push(err60);
                                            }
                                            errors2++;
                                          } else {
                                            if (!formats0.validate(data24)) {
                                              const err61 = { instancePath: instancePath + "/windowRequest/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/4/properties/endExclusive/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                              if (vErrors === null) {
                                                vErrors = [err61];
                                              } else {
                                                vErrors.push(err61);
                                              }
                                              errors2++;
                                            }
                                          }
                                        } else {
                                          const err62 = { instancePath: instancePath + "/windowRequest/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/4/properties/endExclusive/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                          if (vErrors === null) {
                                            vErrors = [err62];
                                          } else {
                                            vErrors.push(err62);
                                          }
                                          errors2++;
                                        }
                                      }
                                    }
                                    var valid13 = _errs66 === errors2;
                                  } else {
                                    var valid13 = true;
                                  }
                                  if (valid13) {
                                    if (data7.timezone !== void 0) {
                                      let data25 = data7.timezone;
                                      const _errs68 = errors2;
                                      if (errors2 === _errs68) {
                                        if (typeof data25 === "string") {
                                          if (func2(data25) > 100) {
                                            const err63 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/4/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                            if (vErrors === null) {
                                              vErrors = [err63];
                                            } else {
                                              vErrors.push(err63);
                                            }
                                            errors2++;
                                          } else {
                                            if (func2(data25) < 1) {
                                              const err64 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/4/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                              if (vErrors === null) {
                                                vErrors = [err64];
                                              } else {
                                                vErrors.push(err64);
                                              }
                                              errors2++;
                                            }
                                          }
                                        } else {
                                          const err65 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/4/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                          if (vErrors === null) {
                                            vErrors = [err65];
                                          } else {
                                            vErrors.push(err65);
                                          }
                                          errors2++;
                                        }
                                      }
                                      var valid13 = _errs68 === errors2;
                                    } else {
                                      var valid13 = true;
                                    }
                                  }
                                }
                              }
                            }
                          }
                        } else {
                          const err66 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/4/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                          if (vErrors === null) {
                            vErrors = [err66];
                          } else {
                            vErrors.push(err66);
                          }
                          errors2++;
                        }
                      }
                      var _valid2 = _errs60 === errors2;
                      if (_valid2 && valid8) {
                        valid8 = false;
                        passing0 = [passing0, 4];
                      } else {
                        if (_valid2) {
                          valid8 = true;
                          passing0 = 4;
                          if (props2 !== true) {
                            props2 = true;
                          }
                        }
                        const _errs70 = errors2;
                        if (errors2 === _errs70) {
                          if (data7 && typeof data7 == "object" && !Array.isArray(data7)) {
                            let missing10;
                            if (data7.basis === void 0 && (missing10 = "basis") || data7.year === void 0 && (missing10 = "year") || data7.calendarId === void 0 && (missing10 = "calendarId") || data7.stage === void 0 && (missing10 = "stage") || data7.revisionId === void 0 && (missing10 = "revisionId") || data7.timezone === void 0 && (missing10 = "timezone")) {
                              const err67 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/required", keyword: "required", params: { missingProperty: missing10 }, message: "must have required property '" + missing10 + "'" };
                              if (vErrors === null) {
                                vErrors = [err67];
                              } else {
                                vErrors.push(err67);
                              }
                              errors2++;
                            } else {
                              const _errs72 = errors2;
                              for (const key6 in data7) {
                                if (!(key6 === "basis" || key6 === "year" || key6 === "calendarId" || key6 === "stage" || key6 === "revisionId" || key6 === "timezone")) {
                                  const err68 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key6 }, message: "must NOT have additional properties" };
                                  if (vErrors === null) {
                                    vErrors = [err68];
                                  } else {
                                    vErrors.push(err68);
                                  }
                                  errors2++;
                                  break;
                                }
                              }
                              if (_errs72 === errors2) {
                                if (data7.basis !== void 0) {
                                  const _errs73 = errors2;
                                  if ("fiscal-year" !== data7.basis) {
                                    const err69 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/basis/const", keyword: "const", params: { allowedValue: "fiscal-year" }, message: "must be equal to constant" };
                                    if (vErrors === null) {
                                      vErrors = [err69];
                                    } else {
                                      vErrors.push(err69);
                                    }
                                    errors2++;
                                  }
                                  var valid14 = _errs73 === errors2;
                                } else {
                                  var valid14 = true;
                                }
                                if (valid14) {
                                  if (data7.year !== void 0) {
                                    let data27 = data7.year;
                                    const _errs74 = errors2;
                                    if (!(typeof data27 == "number" && (!(data27 % 1) && !isNaN(data27)) && isFinite(data27))) {
                                      const err70 = { instancePath: instancePath + "/windowRequest/year", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/year/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                      if (vErrors === null) {
                                        vErrors = [err70];
                                      } else {
                                        vErrors.push(err70);
                                      }
                                      errors2++;
                                    }
                                    if (errors2 === _errs74) {
                                      if (typeof data27 == "number" && isFinite(data27)) {
                                        if (data27 > 3e3 || isNaN(data27)) {
                                          const err71 = { instancePath: instancePath + "/windowRequest/year", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/year/maximum", keyword: "maximum", params: { comparison: "<=", limit: 3e3 }, message: "must be <= 3000" };
                                          if (vErrors === null) {
                                            vErrors = [err71];
                                          } else {
                                            vErrors.push(err71);
                                          }
                                          errors2++;
                                        } else {
                                          if (data27 < 1900 || isNaN(data27)) {
                                            const err72 = { instancePath: instancePath + "/windowRequest/year", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/year/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1900 }, message: "must be >= 1900" };
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
                                    var valid14 = _errs74 === errors2;
                                  } else {
                                    var valid14 = true;
                                  }
                                  if (valid14) {
                                    if (data7.calendarId !== void 0) {
                                      let data28 = data7.calendarId;
                                      const _errs76 = errors2;
                                      if (errors2 === _errs76) {
                                        if (typeof data28 === "string") {
                                          if (func2(data28) > 128) {
                                            const err73 = { instancePath: instancePath + "/windowRequest/calendarId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/calendarId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                                            if (vErrors === null) {
                                              vErrors = [err73];
                                            } else {
                                              vErrors.push(err73);
                                            }
                                            errors2++;
                                          } else {
                                            if (func2(data28) < 1) {
                                              const err74 = { instancePath: instancePath + "/windowRequest/calendarId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/calendarId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                              if (vErrors === null) {
                                                vErrors = [err74];
                                              } else {
                                                vErrors.push(err74);
                                              }
                                              errors2++;
                                            } else {
                                              if (!pattern9.test(data28)) {
                                                const err75 = { instancePath: instancePath + "/windowRequest/calendarId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/calendarId/pattern", keyword: "pattern", params: { pattern: "^[a-z][a-z0-9_.-]*$" }, message: 'must match pattern "^[a-z][a-z0-9_.-]*$"' };
                                                if (vErrors === null) {
                                                  vErrors = [err75];
                                                } else {
                                                  vErrors.push(err75);
                                                }
                                                errors2++;
                                              }
                                            }
                                          }
                                        } else {
                                          const err76 = { instancePath: instancePath + "/windowRequest/calendarId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/calendarId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                          if (vErrors === null) {
                                            vErrors = [err76];
                                          } else {
                                            vErrors.push(err76);
                                          }
                                          errors2++;
                                        }
                                      }
                                      var valid14 = _errs76 === errors2;
                                    } else {
                                      var valid14 = true;
                                    }
                                    if (valid14) {
                                      if (data7.stage !== void 0) {
                                        let data29 = data7.stage;
                                        const _errs78 = errors2;
                                        if (typeof data29 !== "string") {
                                          const err77 = { instancePath: instancePath + "/windowRequest/stage", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/stage/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                          if (vErrors === null) {
                                            vErrors = [err77];
                                          } else {
                                            vErrors.push(err77);
                                          }
                                          errors2++;
                                        }
                                        if (!(data29 === "requested" || data29 === "authorized" || data29 === "appropriated" || data29 === "obligated" || data29 === "actual" || data29 === "outlay")) {
                                          const err78 = { instancePath: instancePath + "/windowRequest/stage", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/stage/enum", keyword: "enum", params: { allowedValues: schema34.oneOf[5].properties.stage.enum }, message: "must be equal to one of the allowed values" };
                                          if (vErrors === null) {
                                            vErrors = [err78];
                                          } else {
                                            vErrors.push(err78);
                                          }
                                          errors2++;
                                        }
                                        var valid14 = _errs78 === errors2;
                                      } else {
                                        var valid14 = true;
                                      }
                                      if (valid14) {
                                        if (data7.revisionId !== void 0) {
                                          let data30 = data7.revisionId;
                                          const _errs80 = errors2;
                                          if (errors2 === _errs80) {
                                            if (typeof data30 === "string") {
                                              if (func2(data30) > 256) {
                                                const err79 = { instancePath: instancePath + "/windowRequest/revisionId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/revisionId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" };
                                                if (vErrors === null) {
                                                  vErrors = [err79];
                                                } else {
                                                  vErrors.push(err79);
                                                }
                                                errors2++;
                                              } else {
                                                if (func2(data30) < 1) {
                                                  const err80 = { instancePath: instancePath + "/windowRequest/revisionId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/revisionId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                                  if (vErrors === null) {
                                                    vErrors = [err80];
                                                  } else {
                                                    vErrors.push(err80);
                                                  }
                                                  errors2++;
                                                }
                                              }
                                            } else {
                                              const err81 = { instancePath: instancePath + "/windowRequest/revisionId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/revisionId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                              if (vErrors === null) {
                                                vErrors = [err81];
                                              } else {
                                                vErrors.push(err81);
                                              }
                                              errors2++;
                                            }
                                          }
                                          var valid14 = _errs80 === errors2;
                                        } else {
                                          var valid14 = true;
                                        }
                                        if (valid14) {
                                          if (data7.timezone !== void 0) {
                                            let data31 = data7.timezone;
                                            const _errs82 = errors2;
                                            if (errors2 === _errs82) {
                                              if (typeof data31 === "string") {
                                                if (func2(data31) > 100) {
                                                  const err82 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                                  if (vErrors === null) {
                                                    vErrors = [err82];
                                                  } else {
                                                    vErrors.push(err82);
                                                  }
                                                  errors2++;
                                                } else {
                                                  if (func2(data31) < 1) {
                                                    const err83 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                                    if (vErrors === null) {
                                                      vErrors = [err83];
                                                    } else {
                                                      vErrors.push(err83);
                                                    }
                                                    errors2++;
                                                  }
                                                }
                                              } else {
                                                const err84 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                if (vErrors === null) {
                                                  vErrors = [err84];
                                                } else {
                                                  vErrors.push(err84);
                                                }
                                                errors2++;
                                              }
                                            }
                                            var valid14 = _errs82 === errors2;
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
                            const err85 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                            if (vErrors === null) {
                              vErrors = [err85];
                            } else {
                              vErrors.push(err85);
                            }
                            errors2++;
                          }
                        }
                        var _valid2 = _errs70 === errors2;
                        if (_valid2 && valid8) {
                          valid8 = false;
                          passing0 = [passing0, 5];
                        } else {
                          if (_valid2) {
                            valid8 = true;
                            passing0 = 5;
                            if (props2 !== true) {
                              props2 = true;
                            }
                          }
                          const _errs84 = errors2;
                          if (errors2 === _errs84) {
                            if (data7 && typeof data7 == "object" && !Array.isArray(data7)) {
                              let missing11;
                              if (data7.basis === void 0 && (missing11 = "basis")) {
                                const err86 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/6/required", keyword: "required", params: { missingProperty: missing11 }, message: "must have required property '" + missing11 + "'" };
                                if (vErrors === null) {
                                  vErrors = [err86];
                                } else {
                                  vErrors.push(err86);
                                }
                                errors2++;
                              } else {
                                const _errs86 = errors2;
                                for (const key7 in data7) {
                                  if (!(key7 === "basis")) {
                                    const err87 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/6/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key7 }, message: "must NOT have additional properties" };
                                    if (vErrors === null) {
                                      vErrors = [err87];
                                    } else {
                                      vErrors.push(err87);
                                    }
                                    errors2++;
                                    break;
                                  }
                                }
                                if (_errs86 === errors2) {
                                  if (data7.basis !== void 0) {
                                    if ("unbounded" !== data7.basis) {
                                      const err88 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/6/properties/basis/const", keyword: "const", params: { allowedValue: "unbounded" }, message: "must be equal to constant" };
                                      if (vErrors === null) {
                                        vErrors = [err88];
                                      } else {
                                        vErrors.push(err88);
                                      }
                                      errors2++;
                                    }
                                  }
                                }
                              }
                            } else {
                              const err89 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/6/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                              if (vErrors === null) {
                                vErrors = [err89];
                              } else {
                                vErrors.push(err89);
                              }
                              errors2++;
                            }
                          }
                          var _valid2 = _errs84 === errors2;
                          if (_valid2 && valid8) {
                            valid8 = false;
                            passing0 = [passing0, 6];
                          } else {
                            if (_valid2) {
                              valid8 = true;
                              passing0 = 6;
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
                if (!valid8) {
                  const err90 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
                  if (vErrors === null) {
                    vErrors = [err90];
                  } else {
                    vErrors.push(err90);
                  }
                  errors2++;
                  validate39.errors = vErrors;
                  return false;
                } else {
                  errors2 = _errs23;
                  if (vErrors !== null) {
                    if (_errs23) {
                      vErrors.length = _errs23;
                    } else {
                      vErrors = null;
                    }
                  }
                }
                var valid6 = _errs21 === errors2;
              } else {
                var valid6 = true;
              }
              if (valid6) {
                if (data.skill !== void 0) {
                  let data33 = data.skill;
                  const _errs88 = errors2;
                  if (errors2 === _errs88) {
                    if (data33 && typeof data33 == "object" && !Array.isArray(data33)) {
                      let missing12;
                      if (data33.skillId === void 0 && (missing12 = "skillId") || data33.skillVersion === void 0 && (missing12 = "skillVersion")) {
                        validate39.errors = [{ instancePath: instancePath + "/skill", schemaPath: "#/properties/skill/required", keyword: "required", params: { missingProperty: missing12 }, message: "must have required property '" + missing12 + "'" }];
                        return false;
                      } else {
                        const _errs90 = errors2;
                        for (const key8 in data33) {
                          if (!(key8 === "skillId" || key8 === "skillVersion")) {
                            validate39.errors = [{ instancePath: instancePath + "/skill", schemaPath: "#/properties/skill/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key8 }, message: "must NOT have additional properties" }];
                            return false;
                            break;
                          }
                        }
                        if (_errs90 === errors2) {
                          if (data33.skillId !== void 0) {
                            let data34 = data33.skillId;
                            const _errs91 = errors2;
                            const _errs92 = errors2;
                            let valid17 = false;
                            const _errs93 = errors2;
                            if (typeof data34 !== "string") {
                              const err91 = { instancePath: instancePath + "/skill/skillId", schemaPath: "#/$defs/Canonical_Canonical_skillId_31e12e8e_20420fe7/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                              if (vErrors === null) {
                                vErrors = [err91];
                              } else {
                                vErrors.push(err91);
                              }
                              errors2++;
                            }
                            if (!(data34 === "quick_skill.research_company" || data34 === "quick_skill.relationship_brief" || data34 === "quick_skill.client_changes" || data34 === "quick_skill.portfolio_changes" || data34 === "quick_skill.portfolio_overlap" || data34 === "quick_skill.mail_history" || data34 === "quick_skill.meeting_prep" || data34 === "quick_skill.commitments_audit" || data34 === "quick_skill.funding_opportunity_match" || data34 === "quick_skill.pe_deep_dive" || data34 === "quick_skill.bill_watch" || data34 === "quick_skill.hearing_watch" || data34 === "quick_skill.representation_lookup" || data34 === "quick_skill.regulatory_docket_brief")) {
                              const err92 = { instancePath: instancePath + "/skill/skillId", schemaPath: "#/$defs/Canonical_Canonical_skillId_31e12e8e_20420fe7/enum", keyword: "enum", params: { allowedValues: schema35.enum }, message: "must be equal to one of the allowed values" };
                              if (vErrors === null) {
                                vErrors = [err92];
                              } else {
                                vErrors.push(err92);
                              }
                              errors2++;
                            }
                            var _valid3 = _errs93 === errors2;
                            valid17 = valid17 || _valid3;
                            const _errs96 = errors2;
                            if (typeof data34 !== "string") {
                              const err93 = { instancePath: instancePath + "/skill/skillId", schemaPath: "#/properties/skill/properties/skillId/anyOf/1/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                              if (vErrors === null) {
                                vErrors = [err93];
                              } else {
                                vErrors.push(err93);
                              }
                              errors2++;
                            }
                            if (!(data34 === "quick_skill.cited_report")) {
                              const err94 = { instancePath: instancePath + "/skill/skillId", schemaPath: "#/properties/skill/properties/skillId/anyOf/1/enum", keyword: "enum", params: { allowedValues: schema33.properties.skill.properties.skillId.anyOf[1].enum }, message: "must be equal to one of the allowed values" };
                              if (vErrors === null) {
                                vErrors = [err94];
                              } else {
                                vErrors.push(err94);
                              }
                              errors2++;
                            }
                            var _valid3 = _errs96 === errors2;
                            valid17 = valid17 || _valid3;
                            if (!valid17) {
                              const err95 = { instancePath: instancePath + "/skill/skillId", schemaPath: "#/properties/skill/properties/skillId/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                              if (vErrors === null) {
                                vErrors = [err95];
                              } else {
                                vErrors.push(err95);
                              }
                              errors2++;
                              validate39.errors = vErrors;
                              return false;
                            } else {
                              errors2 = _errs92;
                              if (vErrors !== null) {
                                if (_errs92) {
                                  vErrors.length = _errs92;
                                } else {
                                  vErrors = null;
                                }
                              }
                            }
                            var valid16 = _errs91 === errors2;
                          } else {
                            var valid16 = true;
                          }
                          if (valid16) {
                            if (data33.skillVersion !== void 0) {
                              let data35 = data33.skillVersion;
                              const _errs99 = errors2;
                              const _errs100 = errors2;
                              if (errors2 === _errs100) {
                                if (typeof data35 === "string") {
                                  if (!pattern10.test(data35)) {
                                    validate39.errors = [{ instancePath: instancePath + "/skill/skillVersion", schemaPath: "#/$defs/Canonical_Canonical_skillVersion_7e2af095_7b29e661/pattern", keyword: "pattern", params: { pattern: "^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)$" }, message: 'must match pattern "^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)$"' }];
                                    return false;
                                  }
                                } else {
                                  validate39.errors = [{ instancePath: instancePath + "/skill/skillVersion", schemaPath: "#/$defs/Canonical_Canonical_skillVersion_7e2af095_7b29e661/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                  return false;
                                }
                              }
                              var valid16 = _errs99 === errors2;
                            } else {
                              var valid16 = true;
                            }
                          }
                        }
                      }
                    } else {
                      validate39.errors = [{ instancePath: instancePath + "/skill", schemaPath: "#/properties/skill/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                      return false;
                    }
                  }
                  var valid6 = _errs88 === errors2;
                } else {
                  var valid6 = true;
                }
                if (valid6) {
                  if (data.modelSelection !== void 0) {
                    let data36 = data.modelSelection;
                    const _errs102 = errors2;
                    if (errors2 === _errs102) {
                      if (data36 && typeof data36 == "object" && !Array.isArray(data36)) {
                        let missing13;
                        if (data36.provider === void 0 && (missing13 = "provider") || data36.modelId === void 0 && (missing13 = "modelId") || data36.effort === void 0 && (missing13 = "effort")) {
                          validate39.errors = [{ instancePath: instancePath + "/modelSelection", schemaPath: "#/properties/modelSelection/required", keyword: "required", params: { missingProperty: missing13 }, message: "must have required property '" + missing13 + "'" }];
                          return false;
                        } else {
                          const _errs104 = errors2;
                          for (const key9 in data36) {
                            if (!(key9 === "provider" || key9 === "modelId" || key9 === "effort")) {
                              validate39.errors = [{ instancePath: instancePath + "/modelSelection", schemaPath: "#/properties/modelSelection/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key9 }, message: "must NOT have additional properties" }];
                              return false;
                              break;
                            }
                          }
                          if (_errs104 === errors2) {
                            if (data36.provider !== void 0) {
                              let data37 = data36.provider;
                              const _errs105 = errors2;
                              if (!(data37 === "bedrock" || data37 === "claude-api")) {
                                validate39.errors = [{ instancePath: instancePath + "/modelSelection/provider", schemaPath: "#/properties/modelSelection/properties/provider/enum", keyword: "enum", params: { allowedValues: schema33.properties.modelSelection.properties.provider.enum }, message: "must be equal to one of the allowed values" }];
                                return false;
                              }
                              var valid20 = _errs105 === errors2;
                            } else {
                              var valid20 = true;
                            }
                            if (valid20) {
                              if (data36.modelId !== void 0) {
                                let data38 = data36.modelId;
                                const _errs106 = errors2;
                                if (errors2 === _errs106) {
                                  if (typeof data38 === "string") {
                                    if (!pattern11.test(data38)) {
                                      validate39.errors = [{ instancePath: instancePath + "/modelSelection/modelId", schemaPath: "#/properties/modelSelection/properties/modelId/pattern", keyword: "pattern", params: { pattern: "^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$" }, message: 'must match pattern "^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$"' }];
                                      return false;
                                    }
                                  } else {
                                    validate39.errors = [{ instancePath: instancePath + "/modelSelection/modelId", schemaPath: "#/properties/modelSelection/properties/modelId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                }
                                var valid20 = _errs106 === errors2;
                              } else {
                                var valid20 = true;
                              }
                              if (valid20) {
                                if (data36.effort !== void 0) {
                                  let data39 = data36.effort;
                                  const _errs108 = errors2;
                                  const _errs109 = errors2;
                                  let valid21 = false;
                                  const _errs110 = errors2;
                                  if (data39 !== null) {
                                    const err96 = { instancePath: instancePath + "/modelSelection/effort", schemaPath: "#/properties/modelSelection/properties/effort/anyOf/0/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                    if (vErrors === null) {
                                      vErrors = [err96];
                                    } else {
                                      vErrors.push(err96);
                                    }
                                    errors2++;
                                  }
                                  var _valid4 = _errs110 === errors2;
                                  valid21 = valid21 || _valid4;
                                  const _errs112 = errors2;
                                  if (typeof data39 !== "string") {
                                    const err97 = { instancePath: instancePath + "/modelSelection/effort", schemaPath: "#/properties/modelSelection/properties/effort/anyOf/1/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                    if (vErrors === null) {
                                      vErrors = [err97];
                                    } else {
                                      vErrors.push(err97);
                                    }
                                    errors2++;
                                  }
                                  if (!(data39 === "low" || data39 === "medium" || data39 === "high" || data39 === "xhigh" || data39 === "max")) {
                                    const err98 = { instancePath: instancePath + "/modelSelection/effort", schemaPath: "#/properties/modelSelection/properties/effort/anyOf/1/enum", keyword: "enum", params: { allowedValues: schema33.properties.modelSelection.properties.effort.anyOf[1].enum }, message: "must be equal to one of the allowed values" };
                                    if (vErrors === null) {
                                      vErrors = [err98];
                                    } else {
                                      vErrors.push(err98);
                                    }
                                    errors2++;
                                  }
                                  var _valid4 = _errs112 === errors2;
                                  valid21 = valid21 || _valid4;
                                  if (!valid21) {
                                    const err99 = { instancePath: instancePath + "/modelSelection/effort", schemaPath: "#/properties/modelSelection/properties/effort/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                    if (vErrors === null) {
                                      vErrors = [err99];
                                    } else {
                                      vErrors.push(err99);
                                    }
                                    errors2++;
                                    validate39.errors = vErrors;
                                    return false;
                                  } else {
                                    errors2 = _errs109;
                                    if (vErrors !== null) {
                                      if (_errs109) {
                                        vErrors.length = _errs109;
                                      } else {
                                        vErrors = null;
                                      }
                                    }
                                  }
                                  var valid20 = _errs108 === errors2;
                                } else {
                                  var valid20 = true;
                                }
                              }
                            }
                          }
                        }
                      } else {
                        validate39.errors = [{ instancePath: instancePath + "/modelSelection", schemaPath: "#/properties/modelSelection/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                        return false;
                      }
                    }
                    var valid6 = _errs102 === errors2;
                  } else {
                    var valid6 = true;
                  }
                  if (valid6) {
                    if (data.documentRevision !== void 0) {
                      let data40 = data.documentRevision;
                      const _errs114 = errors2;
                      if (errors2 === _errs114) {
                        if (data40 && typeof data40 == "object" && !Array.isArray(data40)) {
                          let missing14;
                          if (data40.artifactId === void 0 && (missing14 = "artifactId") || data40.versionId === void 0 && (missing14 = "versionId") || data40.objectSha256 === void 0 && (missing14 = "objectSha256")) {
                            validate39.errors = [{ instancePath: instancePath + "/documentRevision", schemaPath: "#/properties/documentRevision/required", keyword: "required", params: { missingProperty: missing14 }, message: "must have required property '" + missing14 + "'" }];
                            return false;
                          } else {
                            const _errs116 = errors2;
                            for (const key10 in data40) {
                              if (!(key10 === "artifactId" || key10 === "versionId" || key10 === "objectSha256")) {
                                validate39.errors = [{ instancePath: instancePath + "/documentRevision", schemaPath: "#/properties/documentRevision/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key10 }, message: "must NOT have additional properties" }];
                                return false;
                                break;
                              }
                            }
                            if (_errs116 === errors2) {
                              if (data40.artifactId !== void 0) {
                                let data41 = data40.artifactId;
                                const _errs117 = errors2;
                                if (errors2 === _errs117) {
                                  if (typeof data41 === "string") {
                                    if (!pattern4.test(data41)) {
                                      validate39.errors = [{ instancePath: instancePath + "/documentRevision/artifactId", schemaPath: "#/properties/documentRevision/properties/artifactId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' }];
                                      return false;
                                    }
                                  } else {
                                    validate39.errors = [{ instancePath: instancePath + "/documentRevision/artifactId", schemaPath: "#/properties/documentRevision/properties/artifactId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
                                }
                                var valid22 = _errs117 === errors2;
                              } else {
                                var valid22 = true;
                              }
                              if (valid22) {
                                if (data40.versionId !== void 0) {
                                  let data42 = data40.versionId;
                                  const _errs119 = errors2;
                                  if (errors2 === _errs119) {
                                    if (typeof data42 === "string") {
                                      if (!pattern4.test(data42)) {
                                        validate39.errors = [{ instancePath: instancePath + "/documentRevision/versionId", schemaPath: "#/properties/documentRevision/properties/versionId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' }];
                                        return false;
                                      }
                                    } else {
                                      validate39.errors = [{ instancePath: instancePath + "/documentRevision/versionId", schemaPath: "#/properties/documentRevision/properties/versionId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                      return false;
                                    }
                                  }
                                  var valid22 = _errs119 === errors2;
                                } else {
                                  var valid22 = true;
                                }
                                if (valid22) {
                                  if (data40.objectSha256 !== void 0) {
                                    let data43 = data40.objectSha256;
                                    const _errs121 = errors2;
                                    if (errors2 === _errs121) {
                                      if (typeof data43 === "string") {
                                        if (!pattern14.test(data43)) {
                                          validate39.errors = [{ instancePath: instancePath + "/documentRevision/objectSha256", schemaPath: "#/properties/documentRevision/properties/objectSha256/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{64}$" }, message: 'must match pattern "^[0-9a-f]{64}$"' }];
                                          return false;
                                        }
                                      } else {
                                        validate39.errors = [{ instancePath: instancePath + "/documentRevision/objectSha256", schemaPath: "#/properties/documentRevision/properties/objectSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                        return false;
                                      }
                                    }
                                    var valid22 = _errs121 === errors2;
                                  } else {
                                    var valid22 = true;
                                  }
                                }
                              }
                            }
                          }
                        } else {
                          validate39.errors = [{ instancePath: instancePath + "/documentRevision", schemaPath: "#/properties/documentRevision/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                          return false;
                        }
                      }
                      var valid6 = _errs114 === errors2;
                    } else {
                      var valid6 = true;
                    }
                    if (valid6) {
                      if (data.uploads !== void 0) {
                        let data44 = data.uploads;
                        const _errs123 = errors2;
                        if (errors2 === _errs123) {
                          if (Array.isArray(data44)) {
                            if (data44.length > 8) {
                              validate39.errors = [{ instancePath: instancePath + "/uploads", schemaPath: "#/properties/uploads/maxItems", keyword: "maxItems", params: { limit: 8 }, message: "must NOT have more than 8 items" }];
                              return false;
                            } else {
                              if (data44.length < 1) {
                                validate39.errors = [{ instancePath: instancePath + "/uploads", schemaPath: "#/properties/uploads/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                                return false;
                              } else {
                                var valid23 = true;
                                const len0 = data44.length;
                                for (let i0 = 0; i0 < len0; i0++) {
                                  let data45 = data44[i0];
                                  const _errs125 = errors2;
                                  if (errors2 === _errs125) {
                                    if (data45 && typeof data45 == "object" && !Array.isArray(data45)) {
                                      let missing15;
                                      if (data45.uploadId === void 0 && (missing15 = "uploadId") || data45.sha256 === void 0 && (missing15 = "sha256")) {
                                        validate39.errors = [{ instancePath: instancePath + "/uploads/" + i0, schemaPath: "#/properties/uploads/items/required", keyword: "required", params: { missingProperty: missing15 }, message: "must have required property '" + missing15 + "'" }];
                                        return false;
                                      } else {
                                        const _errs127 = errors2;
                                        for (const key11 in data45) {
                                          if (!(key11 === "uploadId" || key11 === "sha256")) {
                                            validate39.errors = [{ instancePath: instancePath + "/uploads/" + i0, schemaPath: "#/properties/uploads/items/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key11 }, message: "must NOT have additional properties" }];
                                            return false;
                                            break;
                                          }
                                        }
                                        if (_errs127 === errors2) {
                                          if (data45.uploadId !== void 0) {
                                            let data46 = data45.uploadId;
                                            const _errs128 = errors2;
                                            if (errors2 === _errs128) {
                                              if (typeof data46 === "string") {
                                                if (!pattern4.test(data46)) {
                                                  validate39.errors = [{ instancePath: instancePath + "/uploads/" + i0 + "/uploadId", schemaPath: "#/properties/uploads/items/properties/uploadId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' }];
                                                  return false;
                                                }
                                              } else {
                                                validate39.errors = [{ instancePath: instancePath + "/uploads/" + i0 + "/uploadId", schemaPath: "#/properties/uploads/items/properties/uploadId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                return false;
                                              }
                                            }
                                            var valid24 = _errs128 === errors2;
                                          } else {
                                            var valid24 = true;
                                          }
                                          if (valid24) {
                                            if (data45.sha256 !== void 0) {
                                              let data47 = data45.sha256;
                                              const _errs130 = errors2;
                                              if (errors2 === _errs130) {
                                                if (typeof data47 === "string") {
                                                  if (!pattern14.test(data47)) {
                                                    validate39.errors = [{ instancePath: instancePath + "/uploads/" + i0 + "/sha256", schemaPath: "#/properties/uploads/items/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{64}$" }, message: 'must match pattern "^[0-9a-f]{64}$"' }];
                                                    return false;
                                                  }
                                                } else {
                                                  validate39.errors = [{ instancePath: instancePath + "/uploads/" + i0 + "/sha256", schemaPath: "#/properties/uploads/items/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                  return false;
                                                }
                                              }
                                              var valid24 = _errs130 === errors2;
                                            } else {
                                              var valid24 = true;
                                            }
                                          }
                                        }
                                      }
                                    } else {
                                      validate39.errors = [{ instancePath: instancePath + "/uploads/" + i0, schemaPath: "#/properties/uploads/items/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                      return false;
                                    }
                                  }
                                  var valid23 = _errs125 === errors2;
                                  if (!valid23) {
                                    break;
                                  }
                                }
                                if (valid23) {
                                  let i1 = data44.length;
                                  let j0;
                                  if (i1 > 1) {
                                    outer0: for (; i1--; ) {
                                      for (j0 = i1; j0--; ) {
                                        if (func0(data44[i1], data44[j0])) {
                                          validate39.errors = [{ instancePath: instancePath + "/uploads", schemaPath: "#/properties/uploads/uniqueItems", keyword: "uniqueItems", params: { i: i1, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)" }];
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
                            validate39.errors = [{ instancePath: instancePath + "/uploads", schemaPath: "#/properties/uploads/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                            return false;
                          }
                        }
                        var valid6 = _errs123 === errors2;
                      } else {
                        var valid6 = true;
                      }
                      if (valid6) {
                        if (data.procedure !== void 0) {
                          let data48 = data.procedure;
                          const _errs132 = errors2;
                          const _errs133 = errors2;
                          let valid26 = false;
                          let passing1 = null;
                          const _errs134 = errors2;
                          if (errors2 === _errs134) {
                            if (data48 && typeof data48 == "object" && !Array.isArray(data48)) {
                              let missing16;
                              if (data48.source === void 0 && (missing16 = "source") || data48.recordId === void 0 && (missing16 = "recordId") || data48.version === void 0 && (missing16 = "version") || data48.manifestDigest === void 0 && (missing16 = "manifestDigest")) {
                                const err100 = { instancePath: instancePath + "/procedure", schemaPath: "#/properties/procedure/oneOf/0/required", keyword: "required", params: { missingProperty: missing16 }, message: "must have required property '" + missing16 + "'" };
                                if (vErrors === null) {
                                  vErrors = [err100];
                                } else {
                                  vErrors.push(err100);
                                }
                                errors2++;
                              } else {
                                const _errs136 = errors2;
                                for (const key12 in data48) {
                                  if (!(key12 === "source" || key12 === "recordId" || key12 === "version" || key12 === "manifestDigest")) {
                                    const err101 = { instancePath: instancePath + "/procedure", schemaPath: "#/properties/procedure/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key12 }, message: "must NOT have additional properties" };
                                    if (vErrors === null) {
                                      vErrors = [err101];
                                    } else {
                                      vErrors.push(err101);
                                    }
                                    errors2++;
                                    break;
                                  }
                                }
                                if (_errs136 === errors2) {
                                  if (data48.source !== void 0) {
                                    const _errs137 = errors2;
                                    if ("firm" !== data48.source) {
                                      const err102 = { instancePath: instancePath + "/procedure/source", schemaPath: "#/properties/procedure/oneOf/0/properties/source/const", keyword: "const", params: { allowedValue: "firm" }, message: "must be equal to constant" };
                                      if (vErrors === null) {
                                        vErrors = [err102];
                                      } else {
                                        vErrors.push(err102);
                                      }
                                      errors2++;
                                    }
                                    var valid27 = _errs137 === errors2;
                                  } else {
                                    var valid27 = true;
                                  }
                                  if (valid27) {
                                    if (data48.recordId !== void 0) {
                                      let data50 = data48.recordId;
                                      const _errs138 = errors2;
                                      if (errors2 === _errs138) {
                                        if (typeof data50 === "string") {
                                          if (!pattern4.test(data50)) {
                                            const err103 = { instancePath: instancePath + "/procedure/recordId", schemaPath: "#/properties/procedure/oneOf/0/properties/recordId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' };
                                            if (vErrors === null) {
                                              vErrors = [err103];
                                            } else {
                                              vErrors.push(err103);
                                            }
                                            errors2++;
                                          }
                                        } else {
                                          const err104 = { instancePath: instancePath + "/procedure/recordId", schemaPath: "#/properties/procedure/oneOf/0/properties/recordId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                          if (vErrors === null) {
                                            vErrors = [err104];
                                          } else {
                                            vErrors.push(err104);
                                          }
                                          errors2++;
                                        }
                                      }
                                      var valid27 = _errs138 === errors2;
                                    } else {
                                      var valid27 = true;
                                    }
                                    if (valid27) {
                                      if (data48.version !== void 0) {
                                        let data51 = data48.version;
                                        const _errs140 = errors2;
                                        if (!(typeof data51 == "number" && (!(data51 % 1) && !isNaN(data51)) && isFinite(data51))) {
                                          const err105 = { instancePath: instancePath + "/procedure/version", schemaPath: "#/properties/procedure/oneOf/0/properties/version/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                          if (vErrors === null) {
                                            vErrors = [err105];
                                          } else {
                                            vErrors.push(err105);
                                          }
                                          errors2++;
                                        }
                                        if (errors2 === _errs140) {
                                          if (typeof data51 == "number" && isFinite(data51)) {
                                            if (data51 > 9007199254740991 || isNaN(data51)) {
                                              const err106 = { instancePath: instancePath + "/procedure/version", schemaPath: "#/properties/procedure/oneOf/0/properties/version/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                              if (vErrors === null) {
                                                vErrors = [err106];
                                              } else {
                                                vErrors.push(err106);
                                              }
                                              errors2++;
                                            } else {
                                              if (data51 < 1 || isNaN(data51)) {
                                                const err107 = { instancePath: instancePath + "/procedure/version", schemaPath: "#/properties/procedure/oneOf/0/properties/version/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                                                if (vErrors === null) {
                                                  vErrors = [err107];
                                                } else {
                                                  vErrors.push(err107);
                                                }
                                                errors2++;
                                              }
                                            }
                                          }
                                        }
                                        var valid27 = _errs140 === errors2;
                                      } else {
                                        var valid27 = true;
                                      }
                                      if (valid27) {
                                        if (data48.manifestDigest !== void 0) {
                                          let data52 = data48.manifestDigest;
                                          const _errs142 = errors2;
                                          if (errors2 === _errs142) {
                                            if (typeof data52 === "string") {
                                              if (!pattern18.test(data52)) {
                                                const err108 = { instancePath: instancePath + "/procedure/manifestDigest", schemaPath: "#/properties/procedure/oneOf/0/properties/manifestDigest/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' };
                                                if (vErrors === null) {
                                                  vErrors = [err108];
                                                } else {
                                                  vErrors.push(err108);
                                                }
                                                errors2++;
                                              }
                                            } else {
                                              const err109 = { instancePath: instancePath + "/procedure/manifestDigest", schemaPath: "#/properties/procedure/oneOf/0/properties/manifestDigest/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                              if (vErrors === null) {
                                                vErrors = [err109];
                                              } else {
                                                vErrors.push(err109);
                                              }
                                              errors2++;
                                            }
                                          }
                                          var valid27 = _errs142 === errors2;
                                        } else {
                                          var valid27 = true;
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            } else {
                              const err110 = { instancePath: instancePath + "/procedure", schemaPath: "#/properties/procedure/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                              if (vErrors === null) {
                                vErrors = [err110];
                              } else {
                                vErrors.push(err110);
                              }
                              errors2++;
                            }
                          }
                          var _valid5 = _errs134 === errors2;
                          if (_valid5) {
                            valid26 = true;
                            passing1 = 0;
                            var props3 = true;
                          }
                          const _errs144 = errors2;
                          if (errors2 === _errs144) {
                            if (data48 && typeof data48 == "object" && !Array.isArray(data48)) {
                              let missing17;
                              if (data48.source === void 0 && (missing17 = "source") || data48.id === void 0 && (missing17 = "id") || data48.version === void 0 && (missing17 = "version") || data48.manifestDigest === void 0 && (missing17 = "manifestDigest")) {
                                const err111 = { instancePath: instancePath + "/procedure", schemaPath: "#/properties/procedure/oneOf/1/required", keyword: "required", params: { missingProperty: missing17 }, message: "must have required property '" + missing17 + "'" };
                                if (vErrors === null) {
                                  vErrors = [err111];
                                } else {
                                  vErrors.push(err111);
                                }
                                errors2++;
                              } else {
                                const _errs146 = errors2;
                                for (const key13 in data48) {
                                  if (!(key13 === "source" || key13 === "id" || key13 === "version" || key13 === "manifestDigest")) {
                                    const err112 = { instancePath: instancePath + "/procedure", schemaPath: "#/properties/procedure/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key13 }, message: "must NOT have additional properties" };
                                    if (vErrors === null) {
                                      vErrors = [err112];
                                    } else {
                                      vErrors.push(err112);
                                    }
                                    errors2++;
                                    break;
                                  }
                                }
                                if (_errs146 === errors2) {
                                  if (data48.source !== void 0) {
                                    const _errs147 = errors2;
                                    if ("builtin" !== data48.source) {
                                      const err113 = { instancePath: instancePath + "/procedure/source", schemaPath: "#/properties/procedure/oneOf/1/properties/source/const", keyword: "const", params: { allowedValue: "builtin" }, message: "must be equal to constant" };
                                      if (vErrors === null) {
                                        vErrors = [err113];
                                      } else {
                                        vErrors.push(err113);
                                      }
                                      errors2++;
                                    }
                                    var valid28 = _errs147 === errors2;
                                  } else {
                                    var valid28 = true;
                                  }
                                  if (valid28) {
                                    if (data48.id !== void 0) {
                                      let data54 = data48.id;
                                      const _errs148 = errors2;
                                      if (!(data54 === "briefing" || data54 === "draft" || data54 === "bill_analysis" || data54 === "hearing_prep" || data54 === "coalition_letter" || data54 === "amendment_tracker")) {
                                        const err114 = { instancePath: instancePath + "/procedure/id", schemaPath: "#/properties/procedure/oneOf/1/properties/id/enum", keyword: "enum", params: { allowedValues: schema33.properties.procedure.oneOf[1].properties.id.enum }, message: "must be equal to one of the allowed values" };
                                        if (vErrors === null) {
                                          vErrors = [err114];
                                        } else {
                                          vErrors.push(err114);
                                        }
                                        errors2++;
                                      }
                                      var valid28 = _errs148 === errors2;
                                    } else {
                                      var valid28 = true;
                                    }
                                    if (valid28) {
                                      if (data48.version !== void 0) {
                                        let data55 = data48.version;
                                        const _errs149 = errors2;
                                        if (!(typeof data55 == "number" && (!(data55 % 1) && !isNaN(data55)) && isFinite(data55))) {
                                          const err115 = { instancePath: instancePath + "/procedure/version", schemaPath: "#/properties/procedure/oneOf/1/properties/version/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                          if (vErrors === null) {
                                            vErrors = [err115];
                                          } else {
                                            vErrors.push(err115);
                                          }
                                          errors2++;
                                        }
                                        if (errors2 === _errs149) {
                                          if (typeof data55 == "number" && isFinite(data55)) {
                                            if (data55 > 9007199254740991 || isNaN(data55)) {
                                              const err116 = { instancePath: instancePath + "/procedure/version", schemaPath: "#/properties/procedure/oneOf/1/properties/version/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                              if (vErrors === null) {
                                                vErrors = [err116];
                                              } else {
                                                vErrors.push(err116);
                                              }
                                              errors2++;
                                            } else {
                                              if (data55 < 1 || isNaN(data55)) {
                                                const err117 = { instancePath: instancePath + "/procedure/version", schemaPath: "#/properties/procedure/oneOf/1/properties/version/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                                                if (vErrors === null) {
                                                  vErrors = [err117];
                                                } else {
                                                  vErrors.push(err117);
                                                }
                                                errors2++;
                                              }
                                            }
                                          }
                                        }
                                        var valid28 = _errs149 === errors2;
                                      } else {
                                        var valid28 = true;
                                      }
                                      if (valid28) {
                                        if (data48.manifestDigest !== void 0) {
                                          let data56 = data48.manifestDigest;
                                          const _errs151 = errors2;
                                          if (errors2 === _errs151) {
                                            if (typeof data56 === "string") {
                                              if (!pattern18.test(data56)) {
                                                const err118 = { instancePath: instancePath + "/procedure/manifestDigest", schemaPath: "#/properties/procedure/oneOf/1/properties/manifestDigest/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' };
                                                if (vErrors === null) {
                                                  vErrors = [err118];
                                                } else {
                                                  vErrors.push(err118);
                                                }
                                                errors2++;
                                              }
                                            } else {
                                              const err119 = { instancePath: instancePath + "/procedure/manifestDigest", schemaPath: "#/properties/procedure/oneOf/1/properties/manifestDigest/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                              if (vErrors === null) {
                                                vErrors = [err119];
                                              } else {
                                                vErrors.push(err119);
                                              }
                                              errors2++;
                                            }
                                          }
                                          var valid28 = _errs151 === errors2;
                                        } else {
                                          var valid28 = true;
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            } else {
                              const err120 = { instancePath: instancePath + "/procedure", schemaPath: "#/properties/procedure/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                              if (vErrors === null) {
                                vErrors = [err120];
                              } else {
                                vErrors.push(err120);
                              }
                              errors2++;
                            }
                          }
                          var _valid5 = _errs144 === errors2;
                          if (_valid5 && valid26) {
                            valid26 = false;
                            passing1 = [passing1, 1];
                          } else {
                            if (_valid5) {
                              valid26 = true;
                              passing1 = 1;
                              if (props3 !== true) {
                                props3 = true;
                              }
                            }
                          }
                          if (!valid26) {
                            const err121 = { instancePath: instancePath + "/procedure", schemaPath: "#/properties/procedure/oneOf", keyword: "oneOf", params: { passingSchemas: passing1 }, message: "must match exactly one schema in oneOf" };
                            if (vErrors === null) {
                              vErrors = [err121];
                            } else {
                              vErrors.push(err121);
                            }
                            errors2++;
                            validate39.errors = vErrors;
                            return false;
                          } else {
                            errors2 = _errs133;
                            if (vErrors !== null) {
                              if (_errs133) {
                                vErrors.length = _errs133;
                              } else {
                                vErrors = null;
                              }
                            }
                          }
                          var valid6 = _errs132 === errors2;
                        } else {
                          var valid6 = true;
                        }
                        if (valid6) {
                          if (data.siteWorkflow !== void 0) {
                            let data57 = data.siteWorkflow;
                            const _errs153 = errors2;
                            if (errors2 === _errs153) {
                              if (data57 && typeof data57 == "object" && !Array.isArray(data57)) {
                                let missing18;
                                if (data57.siteId === void 0 && (missing18 = "siteId") || data57.workflowId === void 0 && (missing18 = "workflowId") || data57.version === void 0 && (missing18 = "version") || data57.manifestSha256 === void 0 && (missing18 = "manifestSha256")) {
                                  validate39.errors = [{ instancePath: instancePath + "/siteWorkflow", schemaPath: "#/properties/siteWorkflow/required", keyword: "required", params: { missingProperty: missing18 }, message: "must have required property '" + missing18 + "'" }];
                                  return false;
                                } else {
                                  const _errs155 = errors2;
                                  for (const key14 in data57) {
                                    if (!(key14 === "siteId" || key14 === "workflowId" || key14 === "version" || key14 === "manifestSha256")) {
                                      validate39.errors = [{ instancePath: instancePath + "/siteWorkflow", schemaPath: "#/properties/siteWorkflow/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key14 }, message: "must NOT have additional properties" }];
                                      return false;
                                      break;
                                    }
                                  }
                                  if (_errs155 === errors2) {
                                    if (data57.siteId !== void 0) {
                                      let data58 = data57.siteId;
                                      const _errs156 = errors2;
                                      if (errors2 === _errs156) {
                                        if (typeof data58 === "string") {
                                          if (!pattern20.test(data58)) {
                                            validate39.errors = [{ instancePath: instancePath + "/siteWorkflow/siteId", schemaPath: "#/properties/siteWorkflow/properties/siteId/pattern", keyword: "pattern", params: { pattern: "^[a-z][a-z0-9-]{1,63}$" }, message: 'must match pattern "^[a-z][a-z0-9-]{1,63}$"' }];
                                            return false;
                                          }
                                        } else {
                                          validate39.errors = [{ instancePath: instancePath + "/siteWorkflow/siteId", schemaPath: "#/properties/siteWorkflow/properties/siteId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                          return false;
                                        }
                                      }
                                      var valid29 = _errs156 === errors2;
                                    } else {
                                      var valid29 = true;
                                    }
                                    if (valid29) {
                                      if (data57.workflowId !== void 0) {
                                        let data59 = data57.workflowId;
                                        const _errs158 = errors2;
                                        if (errors2 === _errs158) {
                                          if (typeof data59 === "string") {
                                            if (!pattern20.test(data59)) {
                                              validate39.errors = [{ instancePath: instancePath + "/siteWorkflow/workflowId", schemaPath: "#/properties/siteWorkflow/properties/workflowId/pattern", keyword: "pattern", params: { pattern: "^[a-z][a-z0-9-]{1,63}$" }, message: 'must match pattern "^[a-z][a-z0-9-]{1,63}$"' }];
                                              return false;
                                            }
                                          } else {
                                            validate39.errors = [{ instancePath: instancePath + "/siteWorkflow/workflowId", schemaPath: "#/properties/siteWorkflow/properties/workflowId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                            return false;
                                          }
                                        }
                                        var valid29 = _errs158 === errors2;
                                      } else {
                                        var valid29 = true;
                                      }
                                      if (valid29) {
                                        if (data57.version !== void 0) {
                                          let data60 = data57.version;
                                          const _errs160 = errors2;
                                          if (!(typeof data60 == "number" && (!(data60 % 1) && !isNaN(data60)) && isFinite(data60))) {
                                            validate39.errors = [{ instancePath: instancePath + "/siteWorkflow/version", schemaPath: "#/properties/siteWorkflow/properties/version/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                            return false;
                                          }
                                          if (errors2 === _errs160) {
                                            if (typeof data60 == "number" && isFinite(data60)) {
                                              if (data60 > 9007199254740991 || isNaN(data60)) {
                                                validate39.errors = [{ instancePath: instancePath + "/siteWorkflow/version", schemaPath: "#/properties/siteWorkflow/properties/version/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                return false;
                                              } else {
                                                if (data60 < 1 || isNaN(data60)) {
                                                  validate39.errors = [{ instancePath: instancePath + "/siteWorkflow/version", schemaPath: "#/properties/siteWorkflow/properties/version/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                                                  return false;
                                                }
                                              }
                                            }
                                          }
                                          var valid29 = _errs160 === errors2;
                                        } else {
                                          var valid29 = true;
                                        }
                                        if (valid29) {
                                          if (data57.manifestSha256 !== void 0) {
                                            let data61 = data57.manifestSha256;
                                            const _errs162 = errors2;
                                            if (errors2 === _errs162) {
                                              if (typeof data61 === "string") {
                                                if (!pattern18.test(data61)) {
                                                  validate39.errors = [{ instancePath: instancePath + "/siteWorkflow/manifestSha256", schemaPath: "#/properties/siteWorkflow/properties/manifestSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                                  return false;
                                                }
                                              } else {
                                                validate39.errors = [{ instancePath: instancePath + "/siteWorkflow/manifestSha256", schemaPath: "#/properties/siteWorkflow/properties/manifestSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                return false;
                                              }
                                            }
                                            var valid29 = _errs162 === errors2;
                                          } else {
                                            var valid29 = true;
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              } else {
                                validate39.errors = [{ instancePath: instancePath + "/siteWorkflow", schemaPath: "#/properties/siteWorkflow/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                return false;
                              }
                            }
                            var valid6 = _errs153 === errors2;
                          } else {
                            var valid6 = true;
                          }
                          if (valid6) {
                            if (data.work !== void 0) {
                              let data62 = data.work;
                              const _errs164 = errors2;
                              if (errors2 === _errs164) {
                                if (data62 && typeof data62 == "object" && !Array.isArray(data62)) {
                                  let missing19;
                                  if (data62.entry === void 0 && (missing19 = "entry") || data62.jobKind === void 0 && (missing19 = "jobKind") || data62.deliverables === void 0 && (missing19 = "deliverables") || data62.dependencies === void 0 && (missing19 = "dependencies")) {
                                    validate39.errors = [{ instancePath: instancePath + "/work", schemaPath: "#/properties/work/required", keyword: "required", params: { missingProperty: missing19 }, message: "must have required property '" + missing19 + "'" }];
                                    return false;
                                  } else {
                                    const _errs166 = errors2;
                                    for (const key15 in data62) {
                                      if (!(key15 === "entry" || key15 === "jobKind" || key15 === "deliverables" || key15 === "dependencies")) {
                                        validate39.errors = [{ instancePath: instancePath + "/work", schemaPath: "#/properties/work/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key15 }, message: "must NOT have additional properties" }];
                                        return false;
                                        break;
                                      }
                                    }
                                    if (_errs166 === errors2) {
                                      if (data62.entry !== void 0) {
                                        let data63 = data62.entry;
                                        const _errs167 = errors2;
                                        if (!(data63 === "start-work" || data63 === "delegate")) {
                                          validate39.errors = [{ instancePath: instancePath + "/work/entry", schemaPath: "#/properties/work/properties/entry/enum", keyword: "enum", params: { allowedValues: schema33.properties.work.properties.entry.enum }, message: "must be equal to one of the allowed values" }];
                                          return false;
                                        }
                                        var valid30 = _errs167 === errors2;
                                      } else {
                                        var valid30 = true;
                                      }
                                      if (valid30) {
                                        if (data62.jobKind !== void 0) {
                                          let data64 = data62.jobKind;
                                          const _errs168 = errors2;
                                          if (!(data64 === "research" || data64 === "deliverable" || data64 === "audit" || data64 === "scheduled")) {
                                            validate39.errors = [{ instancePath: instancePath + "/work/jobKind", schemaPath: "#/properties/work/properties/jobKind/enum", keyword: "enum", params: { allowedValues: schema33.properties.work.properties.jobKind.enum }, message: "must be equal to one of the allowed values" }];
                                            return false;
                                          }
                                          var valid30 = _errs168 === errors2;
                                        } else {
                                          var valid30 = true;
                                        }
                                        if (valid30) {
                                          if (data62.deliverables !== void 0) {
                                            let data65 = data62.deliverables;
                                            const _errs169 = errors2;
                                            if (errors2 === _errs169) {
                                              if (Array.isArray(data65)) {
                                                if (data65.length > 20) {
                                                  validate39.errors = [{ instancePath: instancePath + "/work/deliverables", schemaPath: "#/properties/work/properties/deliverables/maxItems", keyword: "maxItems", params: { limit: 20 }, message: "must NOT have more than 20 items" }];
                                                  return false;
                                                } else {
                                                  var valid31 = true;
                                                  const len1 = data65.length;
                                                  for (let i2 = 0; i2 < len1; i2++) {
                                                    let data66 = data65[i2];
                                                    const _errs171 = errors2;
                                                    if (errors2 === _errs171) {
                                                      if (typeof data66 === "string") {
                                                        if (func2(data66) > 200) {
                                                          validate39.errors = [{ instancePath: instancePath + "/work/deliverables/" + i2, schemaPath: "#/properties/work/properties/deliverables/items/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" }];
                                                          return false;
                                                        } else {
                                                          if (func2(data66) < 1) {
                                                            validate39.errors = [{ instancePath: instancePath + "/work/deliverables/" + i2, schemaPath: "#/properties/work/properties/deliverables/items/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                            return false;
                                                          } else {
                                                            if (!pattern5.test(data66)) {
                                                              validate39.errors = [{ instancePath: instancePath + "/work/deliverables/" + i2, schemaPath: "#/properties/work/properties/deliverables/items/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "\\S"' }];
                                                              return false;
                                                            }
                                                          }
                                                        }
                                                      } else {
                                                        validate39.errors = [{ instancePath: instancePath + "/work/deliverables/" + i2, schemaPath: "#/properties/work/properties/deliverables/items/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                        return false;
                                                      }
                                                    }
                                                    var valid31 = _errs171 === errors2;
                                                    if (!valid31) {
                                                      break;
                                                    }
                                                  }
                                                  if (valid31) {
                                                    let i3 = data65.length;
                                                    let j1;
                                                    if (i3 > 1) {
                                                      const indices0 = {};
                                                      for (; i3--; ) {
                                                        let item0 = data65[i3];
                                                        if (typeof item0 !== "string") {
                                                          continue;
                                                        }
                                                        if (typeof indices0[item0] == "number") {
                                                          j1 = indices0[item0];
                                                          validate39.errors = [{ instancePath: instancePath + "/work/deliverables", schemaPath: "#/properties/work/properties/deliverables/uniqueItems", keyword: "uniqueItems", params: { i: i3, j: j1 }, message: "must NOT have duplicate items (items ## " + j1 + " and " + i3 + " are identical)" }];
                                                          return false;
                                                          break;
                                                        }
                                                        indices0[item0] = i3;
                                                      }
                                                    }
                                                  }
                                                }
                                              } else {
                                                validate39.errors = [{ instancePath: instancePath + "/work/deliverables", schemaPath: "#/properties/work/properties/deliverables/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                                return false;
                                              }
                                            }
                                            var valid30 = _errs169 === errors2;
                                          } else {
                                            var valid30 = true;
                                          }
                                          if (valid30) {
                                            if (data62.dependencies !== void 0) {
                                              let data67 = data62.dependencies;
                                              const _errs173 = errors2;
                                              if (errors2 === _errs173) {
                                                if (Array.isArray(data67)) {
                                                  if (data67.length > 20) {
                                                    validate39.errors = [{ instancePath: instancePath + "/work/dependencies", schemaPath: "#/properties/work/properties/dependencies/maxItems", keyword: "maxItems", params: { limit: 20 }, message: "must NOT have more than 20 items" }];
                                                    return false;
                                                  } else {
                                                    var valid33 = true;
                                                    const len2 = data67.length;
                                                    for (let i4 = 0; i4 < len2; i4++) {
                                                      let data68 = data67[i4];
                                                      const _errs175 = errors2;
                                                      if (errors2 === _errs175) {
                                                        if (typeof data68 === "string") {
                                                          if (func2(data68) > 200) {
                                                            validate39.errors = [{ instancePath: instancePath + "/work/dependencies/" + i4, schemaPath: "#/properties/work/properties/dependencies/items/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" }];
                                                            return false;
                                                          } else {
                                                            if (func2(data68) < 1) {
                                                              validate39.errors = [{ instancePath: instancePath + "/work/dependencies/" + i4, schemaPath: "#/properties/work/properties/dependencies/items/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                              return false;
                                                            } else {
                                                              if (!pattern5.test(data68)) {
                                                                validate39.errors = [{ instancePath: instancePath + "/work/dependencies/" + i4, schemaPath: "#/properties/work/properties/dependencies/items/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "\\S"' }];
                                                                return false;
                                                              }
                                                            }
                                                          }
                                                        } else {
                                                          validate39.errors = [{ instancePath: instancePath + "/work/dependencies/" + i4, schemaPath: "#/properties/work/properties/dependencies/items/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                          return false;
                                                        }
                                                      }
                                                      var valid33 = _errs175 === errors2;
                                                      if (!valid33) {
                                                        break;
                                                      }
                                                    }
                                                    if (valid33) {
                                                      let i5 = data67.length;
                                                      let j2;
                                                      if (i5 > 1) {
                                                        const indices1 = {};
                                                        for (; i5--; ) {
                                                          let item1 = data67[i5];
                                                          if (typeof item1 !== "string") {
                                                            continue;
                                                          }
                                                          if (typeof indices1[item1] == "number") {
                                                            j2 = indices1[item1];
                                                            validate39.errors = [{ instancePath: instancePath + "/work/dependencies", schemaPath: "#/properties/work/properties/dependencies/uniqueItems", keyword: "uniqueItems", params: { i: i5, j: j2 }, message: "must NOT have duplicate items (items ## " + j2 + " and " + i5 + " are identical)" }];
                                                            return false;
                                                            break;
                                                          }
                                                          indices1[item1] = i5;
                                                        }
                                                      }
                                                    }
                                                  }
                                                } else {
                                                  validate39.errors = [{ instancePath: instancePath + "/work/dependencies", schemaPath: "#/properties/work/properties/dependencies/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                                  return false;
                                                }
                                              }
                                              var valid30 = _errs173 === errors2;
                                            } else {
                                              var valid30 = true;
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }
                                } else {
                                  validate39.errors = [{ instancePath: instancePath + "/work", schemaPath: "#/properties/work/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                  return false;
                                }
                              }
                              var valid6 = _errs164 === errors2;
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
var schema38 = { "type": "object", "properties": { "requestId": { "type": "string", "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, "prompt": { "type": "string", "minLength": 1, "maxLength": 1e5, "pattern": "\\S" }, "skill": { "anyOf": [{ "$ref": "#/$defs/Canonical_ConversationSkillAssetPin_3ccfc6bb" }, { "type": "null" }] }, "window": { "anyOf": [{ "$ref": "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24" }, { "type": "null" }] }, "windowRequest": { "anyOf": [{ "$ref": "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042" }, { "type": "null" }] }, "modelSelection": { "type": "object", "properties": { "provider": { "enum": ["bedrock", "claude-api"] }, "modelId": { "type": "string", "pattern": "^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$" }, "effort": { "anyOf": [{ "type": "null" }, { "type": "string", "enum": ["low", "medium", "high", "xhigh", "max"] }] } }, "required": ["provider", "modelId", "effort"], "additionalProperties": false }, "documentRevision": { "type": "object", "properties": { "artifactId": { "type": "string", "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, "versionId": { "type": "string", "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, "objectSha256": { "type": "string", "pattern": "^[0-9a-f]{64}$" } }, "required": ["artifactId", "versionId", "objectSha256"], "additionalProperties": false }, "uploads": { "type": "array", "minItems": 1, "maxItems": 8, "uniqueItems": true, "items": { "type": "object", "properties": { "uploadId": { "type": "string", "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, "sha256": { "type": "string", "pattern": "^[0-9a-f]{64}$" } }, "required": ["uploadId", "sha256"], "additionalProperties": false } }, "procedure": { "oneOf": [{ "type": "object", "properties": { "source": { "const": "firm" }, "recordId": { "type": "string", "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, "version": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 }, "manifestDigest": { "type": "string", "pattern": "^[a-f0-9]{64}$" } }, "required": ["source", "recordId", "version", "manifestDigest"], "additionalProperties": false }, { "type": "object", "properties": { "source": { "const": "builtin" }, "id": { "enum": ["briefing", "draft", "bill_analysis", "hearing_prep", "coalition_letter", "amendment_tracker"] }, "version": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 }, "manifestDigest": { "type": "string", "pattern": "^[a-f0-9]{64}$" } }, "required": ["source", "id", "version", "manifestDigest"], "additionalProperties": false }] }, "siteWorkflow": { "type": "object", "properties": { "siteId": { "type": "string", "pattern": "^[a-z][a-z0-9-]{1,63}$" }, "workflowId": { "type": "string", "pattern": "^[a-z][a-z0-9-]{1,63}$" }, "version": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 }, "manifestSha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" } }, "required": ["siteId", "workflowId", "version", "manifestSha256"], "additionalProperties": false }, "work": { "type": "object", "properties": { "entry": { "enum": ["start-work", "delegate"] }, "jobKind": { "enum": ["research", "deliverable", "audit", "scheduled"] }, "deliverables": { "type": "array", "maxItems": 20, "uniqueItems": true, "items": { "type": "string", "minLength": 1, "maxLength": 200, "pattern": "\\S" } }, "dependencies": { "type": "array", "maxItems": 20, "uniqueItems": true, "items": { "type": "string", "minLength": 1, "maxLength": 200, "pattern": "\\S" } } }, "required": ["entry", "jobKind", "deliverables", "dependencies"], "additionalProperties": false } }, "required": ["requestId", "prompt", "skill", "window", "windowRequest"], "additionalProperties": false, "allOf": [{ "if": { "properties": { "documentRevision": {} }, "required": ["documentRevision"] }, "then": { "properties": { "skill": { "anyOf": [{ "anyOf": [{ "type": "object", "properties": { "skillId": { "const": "quick_skill.bill_watch" }, "skillVersion": { "const": "2.0.0" } }, "required": ["skillId", "skillVersion"] }, { "type": "object", "properties": { "skillId": { "const": "quick_skill.cited_report" }, "skillVersion": { "const": "1.0.0" } }, "required": ["skillId", "skillVersion"] }] }, { "type": "null" }] } } } }, { "if": { "properties": { "procedure": {} }, "required": ["procedure"] }, "then": { "properties": { "skill": { "type": "null" } } } }] };
var schema42 = { "oneOf": [{ "type": "object", "properties": { "basis": { "type": "string", "enum": ["calendar-week", "calendar-month", "calendar-year", "relative-duration", "explicit"] }, "startInclusive": { "type": "string", "format": "date-time", "pattern": "Z$" }, "endExclusive": { "type": "string", "format": "date-time", "pattern": "Z$" }, "timezone": { "type": "string", "minLength": 1, "maxLength": 100 }, "weekStartsOn": { "anyOf": [{ "type": "string", "enum": ["monday", "sunday"] }, { "type": "null" }] } }, "required": ["basis", "startInclusive", "endExclusive", "timezone", "weekStartsOn"], "additionalProperties": false }, { "type": "object", "properties": { "basis": { "const": "fiscal-year" }, "year": { "type": "integer", "minimum": 1900, "maximum": 3e3 }, "calendarId": { "type": "string", "minLength": 1, "maxLength": 128, "pattern": "^[a-z][a-z0-9_.-]*$" }, "stage": { "type": "string", "enum": ["requested", "authorized", "appropriated", "obligated", "actual", "outlay"] }, "revisionId": { "type": "string", "minLength": 1, "maxLength": 256 }, "startInclusive": { "type": "string", "format": "date-time", "pattern": "Z$" }, "endExclusive": { "type": "string", "format": "date-time", "pattern": "Z$" }, "timezone": { "type": "string", "minLength": 1, "maxLength": 100 } }, "required": ["basis", "year", "calendarId", "stage", "revisionId", "startInclusive", "endExclusive", "timezone"], "additionalProperties": false }, { "type": "object", "properties": { "basis": { "const": "unbounded" } }, "required": ["basis"], "additionalProperties": false }] };
var schema39 = { "type": "object", "properties": { "skillId": { "anyOf": [{ "$ref": "#/$defs/Canonical_Canonical_skillId_31e12e8e_20420fe7" }, { "$comment": "Identities added at this version. Adding another one requires a new reviewed version of this file, never an edit to the closed 0.2.0 enum.", "type": "string", "enum": ["quick_skill.cited_report"] }] }, "skillVersion": { "$ref": "#/$defs/Canonical_Canonical_skillVersion_7e2af095_7b29e661" }, "manifestSha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "proseSha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "catalogSha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" } }, "required": ["skillId", "skillVersion", "manifestSha256", "proseSha256", "catalogSha256"], "additionalProperties": false };
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
            const _errs3 = errors2;
            let valid1 = false;
            const _errs4 = errors2;
            if (typeof data0 !== "string") {
              const err0 = { instancePath: instancePath + "/skillId", schemaPath: "#/$defs/Canonical_Canonical_skillId_31e12e8e_20420fe7/type", keyword: "type", params: { type: "string" }, message: "must be string" };
              if (vErrors === null) {
                vErrors = [err0];
              } else {
                vErrors.push(err0);
              }
              errors2++;
            }
            if (!(data0 === "quick_skill.research_company" || data0 === "quick_skill.relationship_brief" || data0 === "quick_skill.client_changes" || data0 === "quick_skill.portfolio_changes" || data0 === "quick_skill.portfolio_overlap" || data0 === "quick_skill.mail_history" || data0 === "quick_skill.meeting_prep" || data0 === "quick_skill.commitments_audit" || data0 === "quick_skill.funding_opportunity_match" || data0 === "quick_skill.pe_deep_dive" || data0 === "quick_skill.bill_watch" || data0 === "quick_skill.hearing_watch" || data0 === "quick_skill.representation_lookup" || data0 === "quick_skill.regulatory_docket_brief")) {
              const err1 = { instancePath: instancePath + "/skillId", schemaPath: "#/$defs/Canonical_Canonical_skillId_31e12e8e_20420fe7/enum", keyword: "enum", params: { allowedValues: schema35.enum }, message: "must be equal to one of the allowed values" };
              if (vErrors === null) {
                vErrors = [err1];
              } else {
                vErrors.push(err1);
              }
              errors2++;
            }
            var _valid0 = _errs4 === errors2;
            valid1 = valid1 || _valid0;
            const _errs7 = errors2;
            if (typeof data0 !== "string") {
              const err2 = { instancePath: instancePath + "/skillId", schemaPath: "#/properties/skillId/anyOf/1/type", keyword: "type", params: { type: "string" }, message: "must be string" };
              if (vErrors === null) {
                vErrors = [err2];
              } else {
                vErrors.push(err2);
              }
              errors2++;
            }
            if (!(data0 === "quick_skill.cited_report")) {
              const err3 = { instancePath: instancePath + "/skillId", schemaPath: "#/properties/skillId/anyOf/1/enum", keyword: "enum", params: { allowedValues: schema39.properties.skillId.anyOf[1].enum }, message: "must be equal to one of the allowed values" };
              if (vErrors === null) {
                vErrors = [err3];
              } else {
                vErrors.push(err3);
              }
              errors2++;
            }
            var _valid0 = _errs7 === errors2;
            valid1 = valid1 || _valid0;
            if (!valid1) {
              const err4 = { instancePath: instancePath + "/skillId", schemaPath: "#/properties/skillId/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
              if (vErrors === null) {
                vErrors = [err4];
              } else {
                vErrors.push(err4);
              }
              errors2++;
              validate26.errors = vErrors;
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
            if (data.skillVersion !== void 0) {
              let data1 = data.skillVersion;
              const _errs10 = errors2;
              const _errs11 = errors2;
              if (errors2 === _errs11) {
                if (typeof data1 === "string") {
                  if (!pattern10.test(data1)) {
                    validate26.errors = [{ instancePath: instancePath + "/skillVersion", schemaPath: "#/$defs/Canonical_Canonical_skillVersion_7e2af095_7b29e661/pattern", keyword: "pattern", params: { pattern: "^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)$" }, message: 'must match pattern "^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)$"' }];
                    return false;
                  }
                } else {
                  validate26.errors = [{ instancePath: instancePath + "/skillVersion", schemaPath: "#/$defs/Canonical_Canonical_skillVersion_7e2af095_7b29e661/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs10 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.manifestSha256 !== void 0) {
                let data2 = data.manifestSha256;
                const _errs13 = errors2;
                if (errors2 === _errs13) {
                  if (typeof data2 === "string") {
                    if (!pattern18.test(data2)) {
                      validate26.errors = [{ instancePath: instancePath + "/manifestSha256", schemaPath: "#/properties/manifestSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                      return false;
                    }
                  } else {
                    validate26.errors = [{ instancePath: instancePath + "/manifestSha256", schemaPath: "#/properties/manifestSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
                  }
                }
                var valid0 = _errs13 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.proseSha256 !== void 0) {
                  let data3 = data.proseSha256;
                  const _errs15 = errors2;
                  if (errors2 === _errs15) {
                    if (typeof data3 === "string") {
                      if (!pattern18.test(data3)) {
                        validate26.errors = [{ instancePath: instancePath + "/proseSha256", schemaPath: "#/properties/proseSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                        return false;
                      }
                    } else {
                      validate26.errors = [{ instancePath: instancePath + "/proseSha256", schemaPath: "#/properties/proseSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                      return false;
                    }
                  }
                  var valid0 = _errs15 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.catalogSha256 !== void 0) {
                    let data4 = data.catalogSha256;
                    const _errs17 = errors2;
                    if (errors2 === _errs17) {
                      if (typeof data4 === "string") {
                        if (!pattern18.test(data4)) {
                          validate26.errors = [{ instancePath: instancePath + "/catalogSha256", schemaPath: "#/properties/catalogSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                          return false;
                        }
                      } else {
                        validate26.errors = [{ instancePath: instancePath + "/catalogSha256", schemaPath: "#/properties/catalogSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
  const _errs1 = errors2;
  const _errs2 = errors2;
  let valid1 = true;
  const _errs3 = errors2;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    let missing0;
    if (data.documentRevision === void 0 && (missing0 = "documentRevision")) {
      const err0 = {};
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors2++;
    }
  }
  var _valid0 = _errs3 === errors2;
  errors2 = _errs2;
  if (vErrors !== null) {
    if (_errs2) {
      vErrors.length = _errs2;
    } else {
      vErrors = null;
    }
  }
  if (_valid0) {
    const _errs4 = errors2;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.skill !== void 0) {
        let data0 = data.skill;
        const _errs6 = errors2;
        let valid3 = false;
        const _errs7 = errors2;
        const _errs8 = errors2;
        let valid4 = false;
        const _errs9 = errors2;
        if (errors2 === _errs9) {
          if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
            let missing1;
            if (data0.skillId === void 0 && (missing1 = "skillId") || data0.skillVersion === void 0 && (missing1 = "skillVersion")) {
              const err1 = { instancePath: instancePath + "/skill", schemaPath: "#/allOf/0/then/properties/skill/anyOf/0/anyOf/0/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" };
              if (vErrors === null) {
                vErrors = [err1];
              } else {
                vErrors.push(err1);
              }
              errors2++;
            } else {
              if (data0.skillId !== void 0) {
                const _errs11 = errors2;
                if ("quick_skill.bill_watch" !== data0.skillId) {
                  const err2 = { instancePath: instancePath + "/skill/skillId", schemaPath: "#/allOf/0/then/properties/skill/anyOf/0/anyOf/0/properties/skillId/const", keyword: "const", params: { allowedValue: "quick_skill.bill_watch" }, message: "must be equal to constant" };
                  if (vErrors === null) {
                    vErrors = [err2];
                  } else {
                    vErrors.push(err2);
                  }
                  errors2++;
                }
                var valid5 = _errs11 === errors2;
              } else {
                var valid5 = true;
              }
              if (valid5) {
                if (data0.skillVersion !== void 0) {
                  const _errs12 = errors2;
                  if ("2.0.0" !== data0.skillVersion) {
                    const err3 = { instancePath: instancePath + "/skill/skillVersion", schemaPath: "#/allOf/0/then/properties/skill/anyOf/0/anyOf/0/properties/skillVersion/const", keyword: "const", params: { allowedValue: "2.0.0" }, message: "must be equal to constant" };
                    if (vErrors === null) {
                      vErrors = [err3];
                    } else {
                      vErrors.push(err3);
                    }
                    errors2++;
                  }
                  var valid5 = _errs12 === errors2;
                } else {
                  var valid5 = true;
                }
              }
            }
          } else {
            const err4 = { instancePath: instancePath + "/skill", schemaPath: "#/allOf/0/then/properties/skill/anyOf/0/anyOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
            if (vErrors === null) {
              vErrors = [err4];
            } else {
              vErrors.push(err4);
            }
            errors2++;
          }
        }
        var _valid2 = _errs9 === errors2;
        valid4 = valid4 || _valid2;
        if (_valid2) {
          var props0 = {};
          props0.skillId = true;
          props0.skillVersion = true;
        }
        const _errs13 = errors2;
        if (errors2 === _errs13) {
          if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
            let missing2;
            if (data0.skillId === void 0 && (missing2 = "skillId") || data0.skillVersion === void 0 && (missing2 = "skillVersion")) {
              const err5 = { instancePath: instancePath + "/skill", schemaPath: "#/allOf/0/then/properties/skill/anyOf/0/anyOf/1/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" };
              if (vErrors === null) {
                vErrors = [err5];
              } else {
                vErrors.push(err5);
              }
              errors2++;
            } else {
              if (data0.skillId !== void 0) {
                const _errs15 = errors2;
                if ("quick_skill.cited_report" !== data0.skillId) {
                  const err6 = { instancePath: instancePath + "/skill/skillId", schemaPath: "#/allOf/0/then/properties/skill/anyOf/0/anyOf/1/properties/skillId/const", keyword: "const", params: { allowedValue: "quick_skill.cited_report" }, message: "must be equal to constant" };
                  if (vErrors === null) {
                    vErrors = [err6];
                  } else {
                    vErrors.push(err6);
                  }
                  errors2++;
                }
                var valid6 = _errs15 === errors2;
              } else {
                var valid6 = true;
              }
              if (valid6) {
                if (data0.skillVersion !== void 0) {
                  const _errs16 = errors2;
                  if ("1.0.0" !== data0.skillVersion) {
                    const err7 = { instancePath: instancePath + "/skill/skillVersion", schemaPath: "#/allOf/0/then/properties/skill/anyOf/0/anyOf/1/properties/skillVersion/const", keyword: "const", params: { allowedValue: "1.0.0" }, message: "must be equal to constant" };
                    if (vErrors === null) {
                      vErrors = [err7];
                    } else {
                      vErrors.push(err7);
                    }
                    errors2++;
                  }
                  var valid6 = _errs16 === errors2;
                } else {
                  var valid6 = true;
                }
              }
            }
          } else {
            const err8 = { instancePath: instancePath + "/skill", schemaPath: "#/allOf/0/then/properties/skill/anyOf/0/anyOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
            if (vErrors === null) {
              vErrors = [err8];
            } else {
              vErrors.push(err8);
            }
            errors2++;
          }
        }
        var _valid2 = _errs13 === errors2;
        valid4 = valid4 || _valid2;
        if (_valid2) {
          if (props0 !== true) {
            props0 = props0 || {};
            props0.skillId = true;
            props0.skillVersion = true;
          }
        }
        if (!valid4) {
          const err9 = { instancePath: instancePath + "/skill", schemaPath: "#/allOf/0/then/properties/skill/anyOf/0/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors2++;
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
        var _valid1 = _errs7 === errors2;
        valid3 = valid3 || _valid1;
        const _errs17 = errors2;
        if (data0 !== null) {
          const err10 = { instancePath: instancePath + "/skill", schemaPath: "#/allOf/0/then/properties/skill/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors2++;
        }
        var _valid1 = _errs17 === errors2;
        valid3 = valid3 || _valid1;
        if (!valid3) {
          const err11 = { instancePath: instancePath + "/skill", schemaPath: "#/allOf/0/then/properties/skill/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors2++;
          validate40.errors = vErrors;
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
      }
    }
    var _valid0 = _errs4 === errors2;
    valid1 = _valid0;
    if (valid1) {
      var props1 = {};
      props1.skill = true;
      props1.documentRevision = true;
    }
  }
  if (!valid1) {
    const err12 = { instancePath, schemaPath: "#/allOf/0/if", keyword: "if", params: { failingKeyword: "then" }, message: 'must match "then" schema' };
    if (vErrors === null) {
      vErrors = [err12];
    } else {
      vErrors.push(err12);
    }
    errors2++;
    validate40.errors = vErrors;
    return false;
  }
  var valid0 = _errs1 === errors2;
  if (valid0) {
    const _errs19 = errors2;
    const _errs20 = errors2;
    let valid7 = true;
    const _errs21 = errors2;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing3;
      if (data.procedure === void 0 && (missing3 = "procedure")) {
        const err13 = {};
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors2++;
      }
    }
    var _valid3 = _errs21 === errors2;
    errors2 = _errs20;
    if (vErrors !== null) {
      if (_errs20) {
        vErrors.length = _errs20;
      } else {
        vErrors = null;
      }
    }
    if (_valid3) {
      const _errs22 = errors2;
      if (data && typeof data == "object" && !Array.isArray(data)) {
        if (data.skill !== void 0) {
          if (data.skill !== null) {
            validate40.errors = [{ instancePath: instancePath + "/skill", schemaPath: "#/allOf/1/then/properties/skill/type", keyword: "type", params: { type: "null" }, message: "must be null" }];
            return false;
          }
        }
      }
      var _valid3 = _errs22 === errors2;
      valid7 = _valid3;
      if (valid7) {
        var props2 = {};
        props2.skill = true;
        props2.procedure = true;
      }
    }
    if (!valid7) {
      const err14 = { instancePath, schemaPath: "#/allOf/1/if", keyword: "if", params: { failingKeyword: "then" }, message: 'must match "then" schema' };
      if (vErrors === null) {
        vErrors = [err14];
      } else {
        vErrors.push(err14);
      }
      errors2++;
      validate40.errors = vErrors;
      return false;
    }
    var valid0 = _errs19 === errors2;
    if (valid0) {
      if (props1 !== true && props2 !== void 0) {
        if (props2 === true) {
          props1 = true;
        } else {
          props1 = props1 || {};
          Object.assign(props1, props2);
        }
      }
    }
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing4;
      if (data.requestId === void 0 && (missing4 = "requestId") || data.prompt === void 0 && (missing4 = "prompt") || data.skill === void 0 && (missing4 = "skill") || data.window === void 0 && (missing4 = "window") || data.windowRequest === void 0 && (missing4 = "windowRequest")) {
        validate40.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing4 }, message: "must have required property '" + missing4 + "'" }];
        return false;
      } else {
        const _errs25 = errors2;
        for (const key0 in data) {
          if (!func1.call(schema38.properties, key0)) {
            validate40.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs25 === errors2) {
          if (data.requestId !== void 0) {
            let data6 = data.requestId;
            const _errs26 = errors2;
            if (errors2 === _errs26) {
              if (typeof data6 === "string") {
                if (!pattern4.test(data6)) {
                  validate40.errors = [{ instancePath: instancePath + "/requestId", schemaPath: "#/properties/requestId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' }];
                  return false;
                }
              } else {
                validate40.errors = [{ instancePath: instancePath + "/requestId", schemaPath: "#/properties/requestId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid9 = _errs26 === errors2;
          } else {
            var valid9 = true;
          }
          if (valid9) {
            if (data.prompt !== void 0) {
              let data7 = data.prompt;
              const _errs28 = errors2;
              if (errors2 === _errs28) {
                if (typeof data7 === "string") {
                  if (func2(data7) > 1e5) {
                    validate40.errors = [{ instancePath: instancePath + "/prompt", schemaPath: "#/properties/prompt/maxLength", keyword: "maxLength", params: { limit: 1e5 }, message: "must NOT have more than 100000 characters" }];
                    return false;
                  } else {
                    if (func2(data7) < 1) {
                      validate40.errors = [{ instancePath: instancePath + "/prompt", schemaPath: "#/properties/prompt/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                      return false;
                    } else {
                      if (!pattern5.test(data7)) {
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
              var valid9 = _errs28 === errors2;
            } else {
              var valid9 = true;
            }
            if (valid9) {
              if (data.skill !== void 0) {
                let data8 = data.skill;
                const _errs30 = errors2;
                const _errs31 = errors2;
                let valid10 = false;
                const _errs32 = errors2;
                if (!validate26(data8, { instancePath: instancePath + "/skill", parentData: data, parentDataProperty: "skill", rootData, dynamicAnchors })) {
                  vErrors = vErrors === null ? validate26.errors : vErrors.concat(validate26.errors);
                  errors2 = vErrors.length;
                }
                var _valid4 = _errs32 === errors2;
                valid10 = valid10 || _valid4;
                const _errs33 = errors2;
                if (data8 !== null) {
                  const err15 = { instancePath: instancePath + "/skill", schemaPath: "#/properties/skill/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                  if (vErrors === null) {
                    vErrors = [err15];
                  } else {
                    vErrors.push(err15);
                  }
                  errors2++;
                }
                var _valid4 = _errs33 === errors2;
                valid10 = valid10 || _valid4;
                if (!valid10) {
                  const err16 = { instancePath: instancePath + "/skill", schemaPath: "#/properties/skill/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                  if (vErrors === null) {
                    vErrors = [err16];
                  } else {
                    vErrors.push(err16);
                  }
                  errors2++;
                  validate40.errors = vErrors;
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
                var valid9 = _errs30 === errors2;
              } else {
                var valid9 = true;
              }
              if (valid9) {
                if (data.window !== void 0) {
                  let data9 = data.window;
                  const _errs35 = errors2;
                  const _errs36 = errors2;
                  let valid11 = false;
                  const _errs37 = errors2;
                  const _errs39 = errors2;
                  let valid13 = false;
                  let passing0 = null;
                  const _errs40 = errors2;
                  if (errors2 === _errs40) {
                    if (data9 && typeof data9 == "object" && !Array.isArray(data9)) {
                      let missing5;
                      if (data9.basis === void 0 && (missing5 = "basis") || data9.startInclusive === void 0 && (missing5 = "startInclusive") || data9.endExclusive === void 0 && (missing5 = "endExclusive") || data9.timezone === void 0 && (missing5 = "timezone") || data9.weekStartsOn === void 0 && (missing5 = "weekStartsOn")) {
                        const err17 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/0/required", keyword: "required", params: { missingProperty: missing5 }, message: "must have required property '" + missing5 + "'" };
                        if (vErrors === null) {
                          vErrors = [err17];
                        } else {
                          vErrors.push(err17);
                        }
                        errors2++;
                      } else {
                        const _errs42 = errors2;
                        for (const key1 in data9) {
                          if (!(key1 === "basis" || key1 === "startInclusive" || key1 === "endExclusive" || key1 === "timezone" || key1 === "weekStartsOn")) {
                            const err18 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
                            if (vErrors === null) {
                              vErrors = [err18];
                            } else {
                              vErrors.push(err18);
                            }
                            errors2++;
                            break;
                          }
                        }
                        if (_errs42 === errors2) {
                          if (data9.basis !== void 0) {
                            let data10 = data9.basis;
                            const _errs43 = errors2;
                            if (typeof data10 !== "string") {
                              const err19 = { instancePath: instancePath + "/window/basis", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/0/properties/basis/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                              if (vErrors === null) {
                                vErrors = [err19];
                              } else {
                                vErrors.push(err19);
                              }
                              errors2++;
                            }
                            if (!(data10 === "calendar-week" || data10 === "calendar-month" || data10 === "calendar-year" || data10 === "relative-duration" || data10 === "explicit")) {
                              const err20 = { instancePath: instancePath + "/window/basis", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/0/properties/basis/enum", keyword: "enum", params: { allowedValues: schema42.oneOf[0].properties.basis.enum }, message: "must be equal to one of the allowed values" };
                              if (vErrors === null) {
                                vErrors = [err20];
                              } else {
                                vErrors.push(err20);
                              }
                              errors2++;
                            }
                            var valid14 = _errs43 === errors2;
                          } else {
                            var valid14 = true;
                          }
                          if (valid14) {
                            if (data9.startInclusive !== void 0) {
                              let data11 = data9.startInclusive;
                              const _errs45 = errors2;
                              if (errors2 === _errs45) {
                                if (errors2 === _errs45) {
                                  if (typeof data11 === "string") {
                                    if (!pattern6.test(data11)) {
                                      const err21 = { instancePath: instancePath + "/window/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/0/properties/startInclusive/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                                      if (vErrors === null) {
                                        vErrors = [err21];
                                      } else {
                                        vErrors.push(err21);
                                      }
                                      errors2++;
                                    } else {
                                      if (!formats0.validate(data11)) {
                                        const err22 = { instancePath: instancePath + "/window/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/0/properties/startInclusive/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                        if (vErrors === null) {
                                          vErrors = [err22];
                                        } else {
                                          vErrors.push(err22);
                                        }
                                        errors2++;
                                      }
                                    }
                                  } else {
                                    const err23 = { instancePath: instancePath + "/window/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/0/properties/startInclusive/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                    if (vErrors === null) {
                                      vErrors = [err23];
                                    } else {
                                      vErrors.push(err23);
                                    }
                                    errors2++;
                                  }
                                }
                              }
                              var valid14 = _errs45 === errors2;
                            } else {
                              var valid14 = true;
                            }
                            if (valid14) {
                              if (data9.endExclusive !== void 0) {
                                let data12 = data9.endExclusive;
                                const _errs47 = errors2;
                                if (errors2 === _errs47) {
                                  if (errors2 === _errs47) {
                                    if (typeof data12 === "string") {
                                      if (!pattern6.test(data12)) {
                                        const err24 = { instancePath: instancePath + "/window/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/0/properties/endExclusive/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                                        if (vErrors === null) {
                                          vErrors = [err24];
                                        } else {
                                          vErrors.push(err24);
                                        }
                                        errors2++;
                                      } else {
                                        if (!formats0.validate(data12)) {
                                          const err25 = { instancePath: instancePath + "/window/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/0/properties/endExclusive/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                          if (vErrors === null) {
                                            vErrors = [err25];
                                          } else {
                                            vErrors.push(err25);
                                          }
                                          errors2++;
                                        }
                                      }
                                    } else {
                                      const err26 = { instancePath: instancePath + "/window/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/0/properties/endExclusive/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                      if (vErrors === null) {
                                        vErrors = [err26];
                                      } else {
                                        vErrors.push(err26);
                                      }
                                      errors2++;
                                    }
                                  }
                                }
                                var valid14 = _errs47 === errors2;
                              } else {
                                var valid14 = true;
                              }
                              if (valid14) {
                                if (data9.timezone !== void 0) {
                                  let data13 = data9.timezone;
                                  const _errs49 = errors2;
                                  if (errors2 === _errs49) {
                                    if (typeof data13 === "string") {
                                      if (func2(data13) > 100) {
                                        const err27 = { instancePath: instancePath + "/window/timezone", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/0/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                        if (vErrors === null) {
                                          vErrors = [err27];
                                        } else {
                                          vErrors.push(err27);
                                        }
                                        errors2++;
                                      } else {
                                        if (func2(data13) < 1) {
                                          const err28 = { instancePath: instancePath + "/window/timezone", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/0/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                          if (vErrors === null) {
                                            vErrors = [err28];
                                          } else {
                                            vErrors.push(err28);
                                          }
                                          errors2++;
                                        }
                                      }
                                    } else {
                                      const err29 = { instancePath: instancePath + "/window/timezone", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/0/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                      if (vErrors === null) {
                                        vErrors = [err29];
                                      } else {
                                        vErrors.push(err29);
                                      }
                                      errors2++;
                                    }
                                  }
                                  var valid14 = _errs49 === errors2;
                                } else {
                                  var valid14 = true;
                                }
                                if (valid14) {
                                  if (data9.weekStartsOn !== void 0) {
                                    let data14 = data9.weekStartsOn;
                                    const _errs51 = errors2;
                                    const _errs52 = errors2;
                                    let valid15 = false;
                                    const _errs53 = errors2;
                                    if (typeof data14 !== "string") {
                                      const err30 = { instancePath: instancePath + "/window/weekStartsOn", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/0/properties/weekStartsOn/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                      if (vErrors === null) {
                                        vErrors = [err30];
                                      } else {
                                        vErrors.push(err30);
                                      }
                                      errors2++;
                                    }
                                    if (!(data14 === "monday" || data14 === "sunday")) {
                                      const err31 = { instancePath: instancePath + "/window/weekStartsOn", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/0/properties/weekStartsOn/anyOf/0/enum", keyword: "enum", params: { allowedValues: schema42.oneOf[0].properties.weekStartsOn.anyOf[0].enum }, message: "must be equal to one of the allowed values" };
                                      if (vErrors === null) {
                                        vErrors = [err31];
                                      } else {
                                        vErrors.push(err31);
                                      }
                                      errors2++;
                                    }
                                    var _valid7 = _errs53 === errors2;
                                    valid15 = valid15 || _valid7;
                                    const _errs55 = errors2;
                                    if (data14 !== null) {
                                      const err32 = { instancePath: instancePath + "/window/weekStartsOn", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/0/properties/weekStartsOn/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                      if (vErrors === null) {
                                        vErrors = [err32];
                                      } else {
                                        vErrors.push(err32);
                                      }
                                      errors2++;
                                    }
                                    var _valid7 = _errs55 === errors2;
                                    valid15 = valid15 || _valid7;
                                    if (!valid15) {
                                      const err33 = { instancePath: instancePath + "/window/weekStartsOn", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/0/properties/weekStartsOn/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                      if (vErrors === null) {
                                        vErrors = [err33];
                                      } else {
                                        vErrors.push(err33);
                                      }
                                      errors2++;
                                    } else {
                                      errors2 = _errs52;
                                      if (vErrors !== null) {
                                        if (_errs52) {
                                          vErrors.length = _errs52;
                                        } else {
                                          vErrors = null;
                                        }
                                      }
                                    }
                                    var valid14 = _errs51 === errors2;
                                  } else {
                                    var valid14 = true;
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    } else {
                      const err34 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                      if (vErrors === null) {
                        vErrors = [err34];
                      } else {
                        vErrors.push(err34);
                      }
                      errors2++;
                    }
                  }
                  var _valid6 = _errs40 === errors2;
                  if (_valid6) {
                    valid13 = true;
                    passing0 = 0;
                    var props4 = true;
                  }
                  const _errs57 = errors2;
                  if (errors2 === _errs57) {
                    if (data9 && typeof data9 == "object" && !Array.isArray(data9)) {
                      let missing6;
                      if (data9.basis === void 0 && (missing6 = "basis") || data9.year === void 0 && (missing6 = "year") || data9.calendarId === void 0 && (missing6 = "calendarId") || data9.stage === void 0 && (missing6 = "stage") || data9.revisionId === void 0 && (missing6 = "revisionId") || data9.startInclusive === void 0 && (missing6 = "startInclusive") || data9.endExclusive === void 0 && (missing6 = "endExclusive") || data9.timezone === void 0 && (missing6 = "timezone")) {
                        const err35 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/required", keyword: "required", params: { missingProperty: missing6 }, message: "must have required property '" + missing6 + "'" };
                        if (vErrors === null) {
                          vErrors = [err35];
                        } else {
                          vErrors.push(err35);
                        }
                        errors2++;
                      } else {
                        const _errs59 = errors2;
                        for (const key2 in data9) {
                          if (!(key2 === "basis" || key2 === "year" || key2 === "calendarId" || key2 === "stage" || key2 === "revisionId" || key2 === "startInclusive" || key2 === "endExclusive" || key2 === "timezone")) {
                            const err36 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
                            if (vErrors === null) {
                              vErrors = [err36];
                            } else {
                              vErrors.push(err36);
                            }
                            errors2++;
                            break;
                          }
                        }
                        if (_errs59 === errors2) {
                          if (data9.basis !== void 0) {
                            const _errs60 = errors2;
                            if ("fiscal-year" !== data9.basis) {
                              const err37 = { instancePath: instancePath + "/window/basis", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/basis/const", keyword: "const", params: { allowedValue: "fiscal-year" }, message: "must be equal to constant" };
                              if (vErrors === null) {
                                vErrors = [err37];
                              } else {
                                vErrors.push(err37);
                              }
                              errors2++;
                            }
                            var valid16 = _errs60 === errors2;
                          } else {
                            var valid16 = true;
                          }
                          if (valid16) {
                            if (data9.year !== void 0) {
                              let data16 = data9.year;
                              const _errs61 = errors2;
                              if (!(typeof data16 == "number" && (!(data16 % 1) && !isNaN(data16)) && isFinite(data16))) {
                                const err38 = { instancePath: instancePath + "/window/year", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/year/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                if (vErrors === null) {
                                  vErrors = [err38];
                                } else {
                                  vErrors.push(err38);
                                }
                                errors2++;
                              }
                              if (errors2 === _errs61) {
                                if (typeof data16 == "number" && isFinite(data16)) {
                                  if (data16 > 3e3 || isNaN(data16)) {
                                    const err39 = { instancePath: instancePath + "/window/year", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/year/maximum", keyword: "maximum", params: { comparison: "<=", limit: 3e3 }, message: "must be <= 3000" };
                                    if (vErrors === null) {
                                      vErrors = [err39];
                                    } else {
                                      vErrors.push(err39);
                                    }
                                    errors2++;
                                  } else {
                                    if (data16 < 1900 || isNaN(data16)) {
                                      const err40 = { instancePath: instancePath + "/window/year", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/year/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1900 }, message: "must be >= 1900" };
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
                              var valid16 = _errs61 === errors2;
                            } else {
                              var valid16 = true;
                            }
                            if (valid16) {
                              if (data9.calendarId !== void 0) {
                                let data17 = data9.calendarId;
                                const _errs63 = errors2;
                                if (errors2 === _errs63) {
                                  if (typeof data17 === "string") {
                                    if (func2(data17) > 128) {
                                      const err41 = { instancePath: instancePath + "/window/calendarId", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/calendarId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                                      if (vErrors === null) {
                                        vErrors = [err41];
                                      } else {
                                        vErrors.push(err41);
                                      }
                                      errors2++;
                                    } else {
                                      if (func2(data17) < 1) {
                                        const err42 = { instancePath: instancePath + "/window/calendarId", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/calendarId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                        if (vErrors === null) {
                                          vErrors = [err42];
                                        } else {
                                          vErrors.push(err42);
                                        }
                                        errors2++;
                                      } else {
                                        if (!pattern9.test(data17)) {
                                          const err43 = { instancePath: instancePath + "/window/calendarId", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/calendarId/pattern", keyword: "pattern", params: { pattern: "^[a-z][a-z0-9_.-]*$" }, message: 'must match pattern "^[a-z][a-z0-9_.-]*$"' };
                                          if (vErrors === null) {
                                            vErrors = [err43];
                                          } else {
                                            vErrors.push(err43);
                                          }
                                          errors2++;
                                        }
                                      }
                                    }
                                  } else {
                                    const err44 = { instancePath: instancePath + "/window/calendarId", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/calendarId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                    if (vErrors === null) {
                                      vErrors = [err44];
                                    } else {
                                      vErrors.push(err44);
                                    }
                                    errors2++;
                                  }
                                }
                                var valid16 = _errs63 === errors2;
                              } else {
                                var valid16 = true;
                              }
                              if (valid16) {
                                if (data9.stage !== void 0) {
                                  let data18 = data9.stage;
                                  const _errs65 = errors2;
                                  if (typeof data18 !== "string") {
                                    const err45 = { instancePath: instancePath + "/window/stage", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/stage/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                    if (vErrors === null) {
                                      vErrors = [err45];
                                    } else {
                                      vErrors.push(err45);
                                    }
                                    errors2++;
                                  }
                                  if (!(data18 === "requested" || data18 === "authorized" || data18 === "appropriated" || data18 === "obligated" || data18 === "actual" || data18 === "outlay")) {
                                    const err46 = { instancePath: instancePath + "/window/stage", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/stage/enum", keyword: "enum", params: { allowedValues: schema42.oneOf[1].properties.stage.enum }, message: "must be equal to one of the allowed values" };
                                    if (vErrors === null) {
                                      vErrors = [err46];
                                    } else {
                                      vErrors.push(err46);
                                    }
                                    errors2++;
                                  }
                                  var valid16 = _errs65 === errors2;
                                } else {
                                  var valid16 = true;
                                }
                                if (valid16) {
                                  if (data9.revisionId !== void 0) {
                                    let data19 = data9.revisionId;
                                    const _errs67 = errors2;
                                    if (errors2 === _errs67) {
                                      if (typeof data19 === "string") {
                                        if (func2(data19) > 256) {
                                          const err47 = { instancePath: instancePath + "/window/revisionId", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/revisionId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" };
                                          if (vErrors === null) {
                                            vErrors = [err47];
                                          } else {
                                            vErrors.push(err47);
                                          }
                                          errors2++;
                                        } else {
                                          if (func2(data19) < 1) {
                                            const err48 = { instancePath: instancePath + "/window/revisionId", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/revisionId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                            if (vErrors === null) {
                                              vErrors = [err48];
                                            } else {
                                              vErrors.push(err48);
                                            }
                                            errors2++;
                                          }
                                        }
                                      } else {
                                        const err49 = { instancePath: instancePath + "/window/revisionId", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/revisionId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                        if (vErrors === null) {
                                          vErrors = [err49];
                                        } else {
                                          vErrors.push(err49);
                                        }
                                        errors2++;
                                      }
                                    }
                                    var valid16 = _errs67 === errors2;
                                  } else {
                                    var valid16 = true;
                                  }
                                  if (valid16) {
                                    if (data9.startInclusive !== void 0) {
                                      let data20 = data9.startInclusive;
                                      const _errs69 = errors2;
                                      if (errors2 === _errs69) {
                                        if (errors2 === _errs69) {
                                          if (typeof data20 === "string") {
                                            if (!pattern6.test(data20)) {
                                              const err50 = { instancePath: instancePath + "/window/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/startInclusive/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                                              if (vErrors === null) {
                                                vErrors = [err50];
                                              } else {
                                                vErrors.push(err50);
                                              }
                                              errors2++;
                                            } else {
                                              if (!formats0.validate(data20)) {
                                                const err51 = { instancePath: instancePath + "/window/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/startInclusive/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                                if (vErrors === null) {
                                                  vErrors = [err51];
                                                } else {
                                                  vErrors.push(err51);
                                                }
                                                errors2++;
                                              }
                                            }
                                          } else {
                                            const err52 = { instancePath: instancePath + "/window/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/startInclusive/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                            if (vErrors === null) {
                                              vErrors = [err52];
                                            } else {
                                              vErrors.push(err52);
                                            }
                                            errors2++;
                                          }
                                        }
                                      }
                                      var valid16 = _errs69 === errors2;
                                    } else {
                                      var valid16 = true;
                                    }
                                    if (valid16) {
                                      if (data9.endExclusive !== void 0) {
                                        let data21 = data9.endExclusive;
                                        const _errs71 = errors2;
                                        if (errors2 === _errs71) {
                                          if (errors2 === _errs71) {
                                            if (typeof data21 === "string") {
                                              if (!pattern6.test(data21)) {
                                                const err53 = { instancePath: instancePath + "/window/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/endExclusive/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                                                if (vErrors === null) {
                                                  vErrors = [err53];
                                                } else {
                                                  vErrors.push(err53);
                                                }
                                                errors2++;
                                              } else {
                                                if (!formats0.validate(data21)) {
                                                  const err54 = { instancePath: instancePath + "/window/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/endExclusive/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                                  if (vErrors === null) {
                                                    vErrors = [err54];
                                                  } else {
                                                    vErrors.push(err54);
                                                  }
                                                  errors2++;
                                                }
                                              }
                                            } else {
                                              const err55 = { instancePath: instancePath + "/window/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/endExclusive/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                              if (vErrors === null) {
                                                vErrors = [err55];
                                              } else {
                                                vErrors.push(err55);
                                              }
                                              errors2++;
                                            }
                                          }
                                        }
                                        var valid16 = _errs71 === errors2;
                                      } else {
                                        var valid16 = true;
                                      }
                                      if (valid16) {
                                        if (data9.timezone !== void 0) {
                                          let data22 = data9.timezone;
                                          const _errs73 = errors2;
                                          if (errors2 === _errs73) {
                                            if (typeof data22 === "string") {
                                              if (func2(data22) > 100) {
                                                const err56 = { instancePath: instancePath + "/window/timezone", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                                if (vErrors === null) {
                                                  vErrors = [err56];
                                                } else {
                                                  vErrors.push(err56);
                                                }
                                                errors2++;
                                              } else {
                                                if (func2(data22) < 1) {
                                                  const err57 = { instancePath: instancePath + "/window/timezone", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                                  if (vErrors === null) {
                                                    vErrors = [err57];
                                                  } else {
                                                    vErrors.push(err57);
                                                  }
                                                  errors2++;
                                                }
                                              }
                                            } else {
                                              const err58 = { instancePath: instancePath + "/window/timezone", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                              if (vErrors === null) {
                                                vErrors = [err58];
                                              } else {
                                                vErrors.push(err58);
                                              }
                                              errors2++;
                                            }
                                          }
                                          var valid16 = _errs73 === errors2;
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
                      const err59 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                      if (vErrors === null) {
                        vErrors = [err59];
                      } else {
                        vErrors.push(err59);
                      }
                      errors2++;
                    }
                  }
                  var _valid6 = _errs57 === errors2;
                  if (_valid6 && valid13) {
                    valid13 = false;
                    passing0 = [passing0, 1];
                  } else {
                    if (_valid6) {
                      valid13 = true;
                      passing0 = 1;
                      if (props4 !== true) {
                        props4 = true;
                      }
                    }
                    const _errs75 = errors2;
                    if (errors2 === _errs75) {
                      if (data9 && typeof data9 == "object" && !Array.isArray(data9)) {
                        let missing7;
                        if (data9.basis === void 0 && (missing7 = "basis")) {
                          const err60 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/2/required", keyword: "required", params: { missingProperty: missing7 }, message: "must have required property '" + missing7 + "'" };
                          if (vErrors === null) {
                            vErrors = [err60];
                          } else {
                            vErrors.push(err60);
                          }
                          errors2++;
                        } else {
                          const _errs77 = errors2;
                          for (const key3 in data9) {
                            if (!(key3 === "basis")) {
                              const err61 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/2/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" };
                              if (vErrors === null) {
                                vErrors = [err61];
                              } else {
                                vErrors.push(err61);
                              }
                              errors2++;
                              break;
                            }
                          }
                          if (_errs77 === errors2) {
                            if (data9.basis !== void 0) {
                              if ("unbounded" !== data9.basis) {
                                const err62 = { instancePath: instancePath + "/window/basis", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/2/properties/basis/const", keyword: "const", params: { allowedValue: "unbounded" }, message: "must be equal to constant" };
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
                      } else {
                        const err63 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/2/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                        if (vErrors === null) {
                          vErrors = [err63];
                        } else {
                          vErrors.push(err63);
                        }
                        errors2++;
                      }
                    }
                    var _valid6 = _errs75 === errors2;
                    if (_valid6 && valid13) {
                      valid13 = false;
                      passing0 = [passing0, 2];
                    } else {
                      if (_valid6) {
                        valid13 = true;
                        passing0 = 2;
                        if (props4 !== true) {
                          props4 = true;
                        }
                      }
                    }
                  }
                  if (!valid13) {
                    const err64 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
                    if (vErrors === null) {
                      vErrors = [err64];
                    } else {
                      vErrors.push(err64);
                    }
                    errors2++;
                  } else {
                    errors2 = _errs39;
                    if (vErrors !== null) {
                      if (_errs39) {
                        vErrors.length = _errs39;
                      } else {
                        vErrors = null;
                      }
                    }
                  }
                  var _valid5 = _errs37 === errors2;
                  valid11 = valid11 || _valid5;
                  const _errs79 = errors2;
                  if (data9 !== null) {
                    const err65 = { instancePath: instancePath + "/window", schemaPath: "#/properties/window/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                    if (vErrors === null) {
                      vErrors = [err65];
                    } else {
                      vErrors.push(err65);
                    }
                    errors2++;
                  }
                  var _valid5 = _errs79 === errors2;
                  valid11 = valid11 || _valid5;
                  if (!valid11) {
                    const err66 = { instancePath: instancePath + "/window", schemaPath: "#/properties/window/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                    if (vErrors === null) {
                      vErrors = [err66];
                    } else {
                      vErrors.push(err66);
                    }
                    errors2++;
                    validate40.errors = vErrors;
                    return false;
                  } else {
                    errors2 = _errs36;
                    if (vErrors !== null) {
                      if (_errs36) {
                        vErrors.length = _errs36;
                      } else {
                        vErrors = null;
                      }
                    }
                  }
                  var valid9 = _errs35 === errors2;
                } else {
                  var valid9 = true;
                }
                if (valid9) {
                  if (data.windowRequest !== void 0) {
                    let data24 = data.windowRequest;
                    const _errs81 = errors2;
                    const _errs82 = errors2;
                    let valid18 = false;
                    const _errs83 = errors2;
                    const _errs85 = errors2;
                    let valid20 = false;
                    let passing1 = null;
                    const _errs86 = errors2;
                    if (errors2 === _errs86) {
                      if (data24 && typeof data24 == "object" && !Array.isArray(data24)) {
                        let missing8;
                        if (data24.basis === void 0 && (missing8 = "basis") || data24.offset === void 0 && (missing8 = "offset") || data24.timezone === void 0 && (missing8 = "timezone") || data24.weekStartsOn === void 0 && (missing8 = "weekStartsOn")) {
                          const err67 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/0/required", keyword: "required", params: { missingProperty: missing8 }, message: "must have required property '" + missing8 + "'" };
                          if (vErrors === null) {
                            vErrors = [err67];
                          } else {
                            vErrors.push(err67);
                          }
                          errors2++;
                        } else {
                          const _errs88 = errors2;
                          for (const key4 in data24) {
                            if (!(key4 === "basis" || key4 === "offset" || key4 === "timezone" || key4 === "weekStartsOn")) {
                              const err68 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key4 }, message: "must NOT have additional properties" };
                              if (vErrors === null) {
                                vErrors = [err68];
                              } else {
                                vErrors.push(err68);
                              }
                              errors2++;
                              break;
                            }
                          }
                          if (_errs88 === errors2) {
                            if (data24.basis !== void 0) {
                              const _errs89 = errors2;
                              if ("calendar-week" !== data24.basis) {
                                const err69 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/0/properties/basis/const", keyword: "const", params: { allowedValue: "calendar-week" }, message: "must be equal to constant" };
                                if (vErrors === null) {
                                  vErrors = [err69];
                                } else {
                                  vErrors.push(err69);
                                }
                                errors2++;
                              }
                              var valid21 = _errs89 === errors2;
                            } else {
                              var valid21 = true;
                            }
                            if (valid21) {
                              if (data24.offset !== void 0) {
                                let data26 = data24.offset;
                                const _errs90 = errors2;
                                if (!(typeof data26 == "number" && (!(data26 % 1) && !isNaN(data26)) && isFinite(data26))) {
                                  const err70 = { instancePath: instancePath + "/windowRequest/offset", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/0/properties/offset/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                  if (vErrors === null) {
                                    vErrors = [err70];
                                  } else {
                                    vErrors.push(err70);
                                  }
                                  errors2++;
                                }
                                if (!(data26 === -1 || data26 === 0)) {
                                  const err71 = { instancePath: instancePath + "/windowRequest/offset", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/0/properties/offset/enum", keyword: "enum", params: { allowedValues: schema34.oneOf[0].properties.offset.enum }, message: "must be equal to one of the allowed values" };
                                  if (vErrors === null) {
                                    vErrors = [err71];
                                  } else {
                                    vErrors.push(err71);
                                  }
                                  errors2++;
                                }
                                var valid21 = _errs90 === errors2;
                              } else {
                                var valid21 = true;
                              }
                              if (valid21) {
                                if (data24.timezone !== void 0) {
                                  let data27 = data24.timezone;
                                  const _errs92 = errors2;
                                  if (errors2 === _errs92) {
                                    if (typeof data27 === "string") {
                                      if (func2(data27) > 100) {
                                        const err72 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/0/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                        if (vErrors === null) {
                                          vErrors = [err72];
                                        } else {
                                          vErrors.push(err72);
                                        }
                                        errors2++;
                                      } else {
                                        if (func2(data27) < 1) {
                                          const err73 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/0/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                          if (vErrors === null) {
                                            vErrors = [err73];
                                          } else {
                                            vErrors.push(err73);
                                          }
                                          errors2++;
                                        }
                                      }
                                    } else {
                                      const err74 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/0/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                      if (vErrors === null) {
                                        vErrors = [err74];
                                      } else {
                                        vErrors.push(err74);
                                      }
                                      errors2++;
                                    }
                                  }
                                  var valid21 = _errs92 === errors2;
                                } else {
                                  var valid21 = true;
                                }
                                if (valid21) {
                                  if (data24.weekStartsOn !== void 0) {
                                    let data28 = data24.weekStartsOn;
                                    const _errs94 = errors2;
                                    if (typeof data28 !== "string") {
                                      const err75 = { instancePath: instancePath + "/windowRequest/weekStartsOn", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/0/properties/weekStartsOn/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                      if (vErrors === null) {
                                        vErrors = [err75];
                                      } else {
                                        vErrors.push(err75);
                                      }
                                      errors2++;
                                    }
                                    if (!(data28 === "monday" || data28 === "sunday")) {
                                      const err76 = { instancePath: instancePath + "/windowRequest/weekStartsOn", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/0/properties/weekStartsOn/enum", keyword: "enum", params: { allowedValues: schema34.oneOf[0].properties.weekStartsOn.enum }, message: "must be equal to one of the allowed values" };
                                      if (vErrors === null) {
                                        vErrors = [err76];
                                      } else {
                                        vErrors.push(err76);
                                      }
                                      errors2++;
                                    }
                                    var valid21 = _errs94 === errors2;
                                  } else {
                                    var valid21 = true;
                                  }
                                }
                              }
                            }
                          }
                        }
                      } else {
                        const err77 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                        if (vErrors === null) {
                          vErrors = [err77];
                        } else {
                          vErrors.push(err77);
                        }
                        errors2++;
                      }
                    }
                    var _valid9 = _errs86 === errors2;
                    if (_valid9) {
                      valid20 = true;
                      passing1 = 0;
                      var props5 = true;
                    }
                    const _errs96 = errors2;
                    if (errors2 === _errs96) {
                      if (data24 && typeof data24 == "object" && !Array.isArray(data24)) {
                        let missing9;
                        if (data24.basis === void 0 && (missing9 = "basis") || data24.offset === void 0 && (missing9 = "offset") || data24.timezone === void 0 && (missing9 = "timezone")) {
                          const err78 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/1/required", keyword: "required", params: { missingProperty: missing9 }, message: "must have required property '" + missing9 + "'" };
                          if (vErrors === null) {
                            vErrors = [err78];
                          } else {
                            vErrors.push(err78);
                          }
                          errors2++;
                        } else {
                          const _errs98 = errors2;
                          for (const key5 in data24) {
                            if (!(key5 === "basis" || key5 === "offset" || key5 === "timezone")) {
                              const err79 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key5 }, message: "must NOT have additional properties" };
                              if (vErrors === null) {
                                vErrors = [err79];
                              } else {
                                vErrors.push(err79);
                              }
                              errors2++;
                              break;
                            }
                          }
                          if (_errs98 === errors2) {
                            if (data24.basis !== void 0) {
                              const _errs99 = errors2;
                              if ("calendar-month" !== data24.basis) {
                                const err80 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/1/properties/basis/const", keyword: "const", params: { allowedValue: "calendar-month" }, message: "must be equal to constant" };
                                if (vErrors === null) {
                                  vErrors = [err80];
                                } else {
                                  vErrors.push(err80);
                                }
                                errors2++;
                              }
                              var valid22 = _errs99 === errors2;
                            } else {
                              var valid22 = true;
                            }
                            if (valid22) {
                              if (data24.offset !== void 0) {
                                let data30 = data24.offset;
                                const _errs100 = errors2;
                                if (!(typeof data30 == "number" && (!(data30 % 1) && !isNaN(data30)) && isFinite(data30))) {
                                  const err81 = { instancePath: instancePath + "/windowRequest/offset", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/1/properties/offset/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                  if (vErrors === null) {
                                    vErrors = [err81];
                                  } else {
                                    vErrors.push(err81);
                                  }
                                  errors2++;
                                }
                                if (!(data30 === -1 || data30 === 0)) {
                                  const err82 = { instancePath: instancePath + "/windowRequest/offset", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/1/properties/offset/enum", keyword: "enum", params: { allowedValues: schema34.oneOf[1].properties.offset.enum }, message: "must be equal to one of the allowed values" };
                                  if (vErrors === null) {
                                    vErrors = [err82];
                                  } else {
                                    vErrors.push(err82);
                                  }
                                  errors2++;
                                }
                                var valid22 = _errs100 === errors2;
                              } else {
                                var valid22 = true;
                              }
                              if (valid22) {
                                if (data24.timezone !== void 0) {
                                  let data31 = data24.timezone;
                                  const _errs102 = errors2;
                                  if (errors2 === _errs102) {
                                    if (typeof data31 === "string") {
                                      if (func2(data31) > 100) {
                                        const err83 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/1/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                        if (vErrors === null) {
                                          vErrors = [err83];
                                        } else {
                                          vErrors.push(err83);
                                        }
                                        errors2++;
                                      } else {
                                        if (func2(data31) < 1) {
                                          const err84 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/1/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                          if (vErrors === null) {
                                            vErrors = [err84];
                                          } else {
                                            vErrors.push(err84);
                                          }
                                          errors2++;
                                        }
                                      }
                                    } else {
                                      const err85 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/1/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                      if (vErrors === null) {
                                        vErrors = [err85];
                                      } else {
                                        vErrors.push(err85);
                                      }
                                      errors2++;
                                    }
                                  }
                                  var valid22 = _errs102 === errors2;
                                } else {
                                  var valid22 = true;
                                }
                              }
                            }
                          }
                        }
                      } else {
                        const err86 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                        if (vErrors === null) {
                          vErrors = [err86];
                        } else {
                          vErrors.push(err86);
                        }
                        errors2++;
                      }
                    }
                    var _valid9 = _errs96 === errors2;
                    if (_valid9 && valid20) {
                      valid20 = false;
                      passing1 = [passing1, 1];
                    } else {
                      if (_valid9) {
                        valid20 = true;
                        passing1 = 1;
                        if (props5 !== true) {
                          props5 = true;
                        }
                      }
                      const _errs104 = errors2;
                      if (errors2 === _errs104) {
                        if (data24 && typeof data24 == "object" && !Array.isArray(data24)) {
                          let missing10;
                          if (data24.basis === void 0 && (missing10 = "basis") || data24.offset === void 0 && (missing10 = "offset") || data24.timezone === void 0 && (missing10 = "timezone")) {
                            const err87 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/2/required", keyword: "required", params: { missingProperty: missing10 }, message: "must have required property '" + missing10 + "'" };
                            if (vErrors === null) {
                              vErrors = [err87];
                            } else {
                              vErrors.push(err87);
                            }
                            errors2++;
                          } else {
                            const _errs106 = errors2;
                            for (const key6 in data24) {
                              if (!(key6 === "basis" || key6 === "offset" || key6 === "timezone")) {
                                const err88 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/2/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key6 }, message: "must NOT have additional properties" };
                                if (vErrors === null) {
                                  vErrors = [err88];
                                } else {
                                  vErrors.push(err88);
                                }
                                errors2++;
                                break;
                              }
                            }
                            if (_errs106 === errors2) {
                              if (data24.basis !== void 0) {
                                const _errs107 = errors2;
                                if ("calendar-year" !== data24.basis) {
                                  const err89 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/2/properties/basis/const", keyword: "const", params: { allowedValue: "calendar-year" }, message: "must be equal to constant" };
                                  if (vErrors === null) {
                                    vErrors = [err89];
                                  } else {
                                    vErrors.push(err89);
                                  }
                                  errors2++;
                                }
                                var valid23 = _errs107 === errors2;
                              } else {
                                var valid23 = true;
                              }
                              if (valid23) {
                                if (data24.offset !== void 0) {
                                  let data33 = data24.offset;
                                  const _errs108 = errors2;
                                  if (!(typeof data33 == "number" && (!(data33 % 1) && !isNaN(data33)) && isFinite(data33))) {
                                    const err90 = { instancePath: instancePath + "/windowRequest/offset", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/2/properties/offset/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                    if (vErrors === null) {
                                      vErrors = [err90];
                                    } else {
                                      vErrors.push(err90);
                                    }
                                    errors2++;
                                  }
                                  if (!(data33 === -1 || data33 === 0)) {
                                    const err91 = { instancePath: instancePath + "/windowRequest/offset", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/2/properties/offset/enum", keyword: "enum", params: { allowedValues: schema34.oneOf[2].properties.offset.enum }, message: "must be equal to one of the allowed values" };
                                    if (vErrors === null) {
                                      vErrors = [err91];
                                    } else {
                                      vErrors.push(err91);
                                    }
                                    errors2++;
                                  }
                                  var valid23 = _errs108 === errors2;
                                } else {
                                  var valid23 = true;
                                }
                                if (valid23) {
                                  if (data24.timezone !== void 0) {
                                    let data34 = data24.timezone;
                                    const _errs110 = errors2;
                                    if (errors2 === _errs110) {
                                      if (typeof data34 === "string") {
                                        if (func2(data34) > 100) {
                                          const err92 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/2/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                          if (vErrors === null) {
                                            vErrors = [err92];
                                          } else {
                                            vErrors.push(err92);
                                          }
                                          errors2++;
                                        } else {
                                          if (func2(data34) < 1) {
                                            const err93 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/2/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                            if (vErrors === null) {
                                              vErrors = [err93];
                                            } else {
                                              vErrors.push(err93);
                                            }
                                            errors2++;
                                          }
                                        }
                                      } else {
                                        const err94 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/2/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                        if (vErrors === null) {
                                          vErrors = [err94];
                                        } else {
                                          vErrors.push(err94);
                                        }
                                        errors2++;
                                      }
                                    }
                                    var valid23 = _errs110 === errors2;
                                  } else {
                                    var valid23 = true;
                                  }
                                }
                              }
                            }
                          }
                        } else {
                          const err95 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/2/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                          if (vErrors === null) {
                            vErrors = [err95];
                          } else {
                            vErrors.push(err95);
                          }
                          errors2++;
                        }
                      }
                      var _valid9 = _errs104 === errors2;
                      if (_valid9 && valid20) {
                        valid20 = false;
                        passing1 = [passing1, 2];
                      } else {
                        if (_valid9) {
                          valid20 = true;
                          passing1 = 2;
                          if (props5 !== true) {
                            props5 = true;
                          }
                        }
                        const _errs112 = errors2;
                        if (errors2 === _errs112) {
                          if (data24 && typeof data24 == "object" && !Array.isArray(data24)) {
                            let missing11;
                            if (data24.basis === void 0 && (missing11 = "basis") || data24.days === void 0 && (missing11 = "days") || data24.anchorAt === void 0 && (missing11 = "anchorAt") || data24.timezone === void 0 && (missing11 = "timezone")) {
                              const err96 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/3/required", keyword: "required", params: { missingProperty: missing11 }, message: "must have required property '" + missing11 + "'" };
                              if (vErrors === null) {
                                vErrors = [err96];
                              } else {
                                vErrors.push(err96);
                              }
                              errors2++;
                            } else {
                              const _errs114 = errors2;
                              for (const key7 in data24) {
                                if (!(key7 === "basis" || key7 === "days" || key7 === "anchorAt" || key7 === "timezone")) {
                                  const err97 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/3/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key7 }, message: "must NOT have additional properties" };
                                  if (vErrors === null) {
                                    vErrors = [err97];
                                  } else {
                                    vErrors.push(err97);
                                  }
                                  errors2++;
                                  break;
                                }
                              }
                              if (_errs114 === errors2) {
                                if (data24.basis !== void 0) {
                                  const _errs115 = errors2;
                                  if ("relative-duration" !== data24.basis) {
                                    const err98 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/3/properties/basis/const", keyword: "const", params: { allowedValue: "relative-duration" }, message: "must be equal to constant" };
                                    if (vErrors === null) {
                                      vErrors = [err98];
                                    } else {
                                      vErrors.push(err98);
                                    }
                                    errors2++;
                                  }
                                  var valid24 = _errs115 === errors2;
                                } else {
                                  var valid24 = true;
                                }
                                if (valid24) {
                                  if (data24.days !== void 0) {
                                    let data36 = data24.days;
                                    const _errs116 = errors2;
                                    if (!(typeof data36 == "number" && (!(data36 % 1) && !isNaN(data36)) && isFinite(data36))) {
                                      const err99 = { instancePath: instancePath + "/windowRequest/days", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/3/properties/days/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                      if (vErrors === null) {
                                        vErrors = [err99];
                                      } else {
                                        vErrors.push(err99);
                                      }
                                      errors2++;
                                    }
                                    if (errors2 === _errs116) {
                                      if (typeof data36 == "number" && isFinite(data36)) {
                                        if (data36 > 3660 || isNaN(data36)) {
                                          const err100 = { instancePath: instancePath + "/windowRequest/days", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/3/properties/days/maximum", keyword: "maximum", params: { comparison: "<=", limit: 3660 }, message: "must be <= 3660" };
                                          if (vErrors === null) {
                                            vErrors = [err100];
                                          } else {
                                            vErrors.push(err100);
                                          }
                                          errors2++;
                                        } else {
                                          if (data36 < 1 || isNaN(data36)) {
                                            const err101 = { instancePath: instancePath + "/windowRequest/days", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/3/properties/days/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                                            if (vErrors === null) {
                                              vErrors = [err101];
                                            } else {
                                              vErrors.push(err101);
                                            }
                                            errors2++;
                                          }
                                        }
                                      }
                                    }
                                    var valid24 = _errs116 === errors2;
                                  } else {
                                    var valid24 = true;
                                  }
                                  if (valid24) {
                                    if (data24.anchorAt !== void 0) {
                                      let data37 = data24.anchorAt;
                                      const _errs118 = errors2;
                                      if (errors2 === _errs118) {
                                        if (errors2 === _errs118) {
                                          if (typeof data37 === "string") {
                                            if (!pattern6.test(data37)) {
                                              const err102 = { instancePath: instancePath + "/windowRequest/anchorAt", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/3/properties/anchorAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                                              if (vErrors === null) {
                                                vErrors = [err102];
                                              } else {
                                                vErrors.push(err102);
                                              }
                                              errors2++;
                                            } else {
                                              if (!formats0.validate(data37)) {
                                                const err103 = { instancePath: instancePath + "/windowRequest/anchorAt", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/3/properties/anchorAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                                if (vErrors === null) {
                                                  vErrors = [err103];
                                                } else {
                                                  vErrors.push(err103);
                                                }
                                                errors2++;
                                              }
                                            }
                                          } else {
                                            const err104 = { instancePath: instancePath + "/windowRequest/anchorAt", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/3/properties/anchorAt/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                            if (vErrors === null) {
                                              vErrors = [err104];
                                            } else {
                                              vErrors.push(err104);
                                            }
                                            errors2++;
                                          }
                                        }
                                      }
                                      var valid24 = _errs118 === errors2;
                                    } else {
                                      var valid24 = true;
                                    }
                                    if (valid24) {
                                      if (data24.timezone !== void 0) {
                                        let data38 = data24.timezone;
                                        const _errs120 = errors2;
                                        if (errors2 === _errs120) {
                                          if (typeof data38 === "string") {
                                            if (func2(data38) > 100) {
                                              const err105 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/3/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                              if (vErrors === null) {
                                                vErrors = [err105];
                                              } else {
                                                vErrors.push(err105);
                                              }
                                              errors2++;
                                            } else {
                                              if (func2(data38) < 1) {
                                                const err106 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/3/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                                if (vErrors === null) {
                                                  vErrors = [err106];
                                                } else {
                                                  vErrors.push(err106);
                                                }
                                                errors2++;
                                              }
                                            }
                                          } else {
                                            const err107 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/3/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                            if (vErrors === null) {
                                              vErrors = [err107];
                                            } else {
                                              vErrors.push(err107);
                                            }
                                            errors2++;
                                          }
                                        }
                                        var valid24 = _errs120 === errors2;
                                      } else {
                                        var valid24 = true;
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          } else {
                            const err108 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/3/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                            if (vErrors === null) {
                              vErrors = [err108];
                            } else {
                              vErrors.push(err108);
                            }
                            errors2++;
                          }
                        }
                        var _valid9 = _errs112 === errors2;
                        if (_valid9 && valid20) {
                          valid20 = false;
                          passing1 = [passing1, 3];
                        } else {
                          if (_valid9) {
                            valid20 = true;
                            passing1 = 3;
                            if (props5 !== true) {
                              props5 = true;
                            }
                          }
                          const _errs122 = errors2;
                          if (errors2 === _errs122) {
                            if (data24 && typeof data24 == "object" && !Array.isArray(data24)) {
                              let missing12;
                              if (data24.basis === void 0 && (missing12 = "basis") || data24.startInclusive === void 0 && (missing12 = "startInclusive") || data24.endExclusive === void 0 && (missing12 = "endExclusive") || data24.timezone === void 0 && (missing12 = "timezone")) {
                                const err109 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/4/required", keyword: "required", params: { missingProperty: missing12 }, message: "must have required property '" + missing12 + "'" };
                                if (vErrors === null) {
                                  vErrors = [err109];
                                } else {
                                  vErrors.push(err109);
                                }
                                errors2++;
                              } else {
                                const _errs124 = errors2;
                                for (const key8 in data24) {
                                  if (!(key8 === "basis" || key8 === "startInclusive" || key8 === "endExclusive" || key8 === "timezone")) {
                                    const err110 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/4/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key8 }, message: "must NOT have additional properties" };
                                    if (vErrors === null) {
                                      vErrors = [err110];
                                    } else {
                                      vErrors.push(err110);
                                    }
                                    errors2++;
                                    break;
                                  }
                                }
                                if (_errs124 === errors2) {
                                  if (data24.basis !== void 0) {
                                    const _errs125 = errors2;
                                    if ("explicit" !== data24.basis) {
                                      const err111 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/4/properties/basis/const", keyword: "const", params: { allowedValue: "explicit" }, message: "must be equal to constant" };
                                      if (vErrors === null) {
                                        vErrors = [err111];
                                      } else {
                                        vErrors.push(err111);
                                      }
                                      errors2++;
                                    }
                                    var valid25 = _errs125 === errors2;
                                  } else {
                                    var valid25 = true;
                                  }
                                  if (valid25) {
                                    if (data24.startInclusive !== void 0) {
                                      let data40 = data24.startInclusive;
                                      const _errs126 = errors2;
                                      if (errors2 === _errs126) {
                                        if (errors2 === _errs126) {
                                          if (typeof data40 === "string") {
                                            if (!pattern6.test(data40)) {
                                              const err112 = { instancePath: instancePath + "/windowRequest/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/4/properties/startInclusive/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                                              if (vErrors === null) {
                                                vErrors = [err112];
                                              } else {
                                                vErrors.push(err112);
                                              }
                                              errors2++;
                                            } else {
                                              if (!formats0.validate(data40)) {
                                                const err113 = { instancePath: instancePath + "/windowRequest/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/4/properties/startInclusive/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                                if (vErrors === null) {
                                                  vErrors = [err113];
                                                } else {
                                                  vErrors.push(err113);
                                                }
                                                errors2++;
                                              }
                                            }
                                          } else {
                                            const err114 = { instancePath: instancePath + "/windowRequest/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/4/properties/startInclusive/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                            if (vErrors === null) {
                                              vErrors = [err114];
                                            } else {
                                              vErrors.push(err114);
                                            }
                                            errors2++;
                                          }
                                        }
                                      }
                                      var valid25 = _errs126 === errors2;
                                    } else {
                                      var valid25 = true;
                                    }
                                    if (valid25) {
                                      if (data24.endExclusive !== void 0) {
                                        let data41 = data24.endExclusive;
                                        const _errs128 = errors2;
                                        if (errors2 === _errs128) {
                                          if (errors2 === _errs128) {
                                            if (typeof data41 === "string") {
                                              if (!pattern6.test(data41)) {
                                                const err115 = { instancePath: instancePath + "/windowRequest/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/4/properties/endExclusive/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                                                if (vErrors === null) {
                                                  vErrors = [err115];
                                                } else {
                                                  vErrors.push(err115);
                                                }
                                                errors2++;
                                              } else {
                                                if (!formats0.validate(data41)) {
                                                  const err116 = { instancePath: instancePath + "/windowRequest/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/4/properties/endExclusive/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                                  if (vErrors === null) {
                                                    vErrors = [err116];
                                                  } else {
                                                    vErrors.push(err116);
                                                  }
                                                  errors2++;
                                                }
                                              }
                                            } else {
                                              const err117 = { instancePath: instancePath + "/windowRequest/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/4/properties/endExclusive/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                              if (vErrors === null) {
                                                vErrors = [err117];
                                              } else {
                                                vErrors.push(err117);
                                              }
                                              errors2++;
                                            }
                                          }
                                        }
                                        var valid25 = _errs128 === errors2;
                                      } else {
                                        var valid25 = true;
                                      }
                                      if (valid25) {
                                        if (data24.timezone !== void 0) {
                                          let data42 = data24.timezone;
                                          const _errs130 = errors2;
                                          if (errors2 === _errs130) {
                                            if (typeof data42 === "string") {
                                              if (func2(data42) > 100) {
                                                const err118 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/4/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                                if (vErrors === null) {
                                                  vErrors = [err118];
                                                } else {
                                                  vErrors.push(err118);
                                                }
                                                errors2++;
                                              } else {
                                                if (func2(data42) < 1) {
                                                  const err119 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/4/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                                  if (vErrors === null) {
                                                    vErrors = [err119];
                                                  } else {
                                                    vErrors.push(err119);
                                                  }
                                                  errors2++;
                                                }
                                              }
                                            } else {
                                              const err120 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/4/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                              if (vErrors === null) {
                                                vErrors = [err120];
                                              } else {
                                                vErrors.push(err120);
                                              }
                                              errors2++;
                                            }
                                          }
                                          var valid25 = _errs130 === errors2;
                                        } else {
                                          var valid25 = true;
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            } else {
                              const err121 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/4/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                              if (vErrors === null) {
                                vErrors = [err121];
                              } else {
                                vErrors.push(err121);
                              }
                              errors2++;
                            }
                          }
                          var _valid9 = _errs122 === errors2;
                          if (_valid9 && valid20) {
                            valid20 = false;
                            passing1 = [passing1, 4];
                          } else {
                            if (_valid9) {
                              valid20 = true;
                              passing1 = 4;
                              if (props5 !== true) {
                                props5 = true;
                              }
                            }
                            const _errs132 = errors2;
                            if (errors2 === _errs132) {
                              if (data24 && typeof data24 == "object" && !Array.isArray(data24)) {
                                let missing13;
                                if (data24.basis === void 0 && (missing13 = "basis") || data24.year === void 0 && (missing13 = "year") || data24.calendarId === void 0 && (missing13 = "calendarId") || data24.stage === void 0 && (missing13 = "stage") || data24.revisionId === void 0 && (missing13 = "revisionId") || data24.timezone === void 0 && (missing13 = "timezone")) {
                                  const err122 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/required", keyword: "required", params: { missingProperty: missing13 }, message: "must have required property '" + missing13 + "'" };
                                  if (vErrors === null) {
                                    vErrors = [err122];
                                  } else {
                                    vErrors.push(err122);
                                  }
                                  errors2++;
                                } else {
                                  const _errs134 = errors2;
                                  for (const key9 in data24) {
                                    if (!(key9 === "basis" || key9 === "year" || key9 === "calendarId" || key9 === "stage" || key9 === "revisionId" || key9 === "timezone")) {
                                      const err123 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key9 }, message: "must NOT have additional properties" };
                                      if (vErrors === null) {
                                        vErrors = [err123];
                                      } else {
                                        vErrors.push(err123);
                                      }
                                      errors2++;
                                      break;
                                    }
                                  }
                                  if (_errs134 === errors2) {
                                    if (data24.basis !== void 0) {
                                      const _errs135 = errors2;
                                      if ("fiscal-year" !== data24.basis) {
                                        const err124 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/basis/const", keyword: "const", params: { allowedValue: "fiscal-year" }, message: "must be equal to constant" };
                                        if (vErrors === null) {
                                          vErrors = [err124];
                                        } else {
                                          vErrors.push(err124);
                                        }
                                        errors2++;
                                      }
                                      var valid26 = _errs135 === errors2;
                                    } else {
                                      var valid26 = true;
                                    }
                                    if (valid26) {
                                      if (data24.year !== void 0) {
                                        let data44 = data24.year;
                                        const _errs136 = errors2;
                                        if (!(typeof data44 == "number" && (!(data44 % 1) && !isNaN(data44)) && isFinite(data44))) {
                                          const err125 = { instancePath: instancePath + "/windowRequest/year", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/year/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                          if (vErrors === null) {
                                            vErrors = [err125];
                                          } else {
                                            vErrors.push(err125);
                                          }
                                          errors2++;
                                        }
                                        if (errors2 === _errs136) {
                                          if (typeof data44 == "number" && isFinite(data44)) {
                                            if (data44 > 3e3 || isNaN(data44)) {
                                              const err126 = { instancePath: instancePath + "/windowRequest/year", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/year/maximum", keyword: "maximum", params: { comparison: "<=", limit: 3e3 }, message: "must be <= 3000" };
                                              if (vErrors === null) {
                                                vErrors = [err126];
                                              } else {
                                                vErrors.push(err126);
                                              }
                                              errors2++;
                                            } else {
                                              if (data44 < 1900 || isNaN(data44)) {
                                                const err127 = { instancePath: instancePath + "/windowRequest/year", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/year/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1900 }, message: "must be >= 1900" };
                                                if (vErrors === null) {
                                                  vErrors = [err127];
                                                } else {
                                                  vErrors.push(err127);
                                                }
                                                errors2++;
                                              }
                                            }
                                          }
                                        }
                                        var valid26 = _errs136 === errors2;
                                      } else {
                                        var valid26 = true;
                                      }
                                      if (valid26) {
                                        if (data24.calendarId !== void 0) {
                                          let data45 = data24.calendarId;
                                          const _errs138 = errors2;
                                          if (errors2 === _errs138) {
                                            if (typeof data45 === "string") {
                                              if (func2(data45) > 128) {
                                                const err128 = { instancePath: instancePath + "/windowRequest/calendarId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/calendarId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                                                if (vErrors === null) {
                                                  vErrors = [err128];
                                                } else {
                                                  vErrors.push(err128);
                                                }
                                                errors2++;
                                              } else {
                                                if (func2(data45) < 1) {
                                                  const err129 = { instancePath: instancePath + "/windowRequest/calendarId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/calendarId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                                  if (vErrors === null) {
                                                    vErrors = [err129];
                                                  } else {
                                                    vErrors.push(err129);
                                                  }
                                                  errors2++;
                                                } else {
                                                  if (!pattern9.test(data45)) {
                                                    const err130 = { instancePath: instancePath + "/windowRequest/calendarId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/calendarId/pattern", keyword: "pattern", params: { pattern: "^[a-z][a-z0-9_.-]*$" }, message: 'must match pattern "^[a-z][a-z0-9_.-]*$"' };
                                                    if (vErrors === null) {
                                                      vErrors = [err130];
                                                    } else {
                                                      vErrors.push(err130);
                                                    }
                                                    errors2++;
                                                  }
                                                }
                                              }
                                            } else {
                                              const err131 = { instancePath: instancePath + "/windowRequest/calendarId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/calendarId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                              if (vErrors === null) {
                                                vErrors = [err131];
                                              } else {
                                                vErrors.push(err131);
                                              }
                                              errors2++;
                                            }
                                          }
                                          var valid26 = _errs138 === errors2;
                                        } else {
                                          var valid26 = true;
                                        }
                                        if (valid26) {
                                          if (data24.stage !== void 0) {
                                            let data46 = data24.stage;
                                            const _errs140 = errors2;
                                            if (typeof data46 !== "string") {
                                              const err132 = { instancePath: instancePath + "/windowRequest/stage", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/stage/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                              if (vErrors === null) {
                                                vErrors = [err132];
                                              } else {
                                                vErrors.push(err132);
                                              }
                                              errors2++;
                                            }
                                            if (!(data46 === "requested" || data46 === "authorized" || data46 === "appropriated" || data46 === "obligated" || data46 === "actual" || data46 === "outlay")) {
                                              const err133 = { instancePath: instancePath + "/windowRequest/stage", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/stage/enum", keyword: "enum", params: { allowedValues: schema34.oneOf[5].properties.stage.enum }, message: "must be equal to one of the allowed values" };
                                              if (vErrors === null) {
                                                vErrors = [err133];
                                              } else {
                                                vErrors.push(err133);
                                              }
                                              errors2++;
                                            }
                                            var valid26 = _errs140 === errors2;
                                          } else {
                                            var valid26 = true;
                                          }
                                          if (valid26) {
                                            if (data24.revisionId !== void 0) {
                                              let data47 = data24.revisionId;
                                              const _errs142 = errors2;
                                              if (errors2 === _errs142) {
                                                if (typeof data47 === "string") {
                                                  if (func2(data47) > 256) {
                                                    const err134 = { instancePath: instancePath + "/windowRequest/revisionId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/revisionId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" };
                                                    if (vErrors === null) {
                                                      vErrors = [err134];
                                                    } else {
                                                      vErrors.push(err134);
                                                    }
                                                    errors2++;
                                                  } else {
                                                    if (func2(data47) < 1) {
                                                      const err135 = { instancePath: instancePath + "/windowRequest/revisionId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/revisionId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                                      if (vErrors === null) {
                                                        vErrors = [err135];
                                                      } else {
                                                        vErrors.push(err135);
                                                      }
                                                      errors2++;
                                                    }
                                                  }
                                                } else {
                                                  const err136 = { instancePath: instancePath + "/windowRequest/revisionId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/revisionId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                  if (vErrors === null) {
                                                    vErrors = [err136];
                                                  } else {
                                                    vErrors.push(err136);
                                                  }
                                                  errors2++;
                                                }
                                              }
                                              var valid26 = _errs142 === errors2;
                                            } else {
                                              var valid26 = true;
                                            }
                                            if (valid26) {
                                              if (data24.timezone !== void 0) {
                                                let data48 = data24.timezone;
                                                const _errs144 = errors2;
                                                if (errors2 === _errs144) {
                                                  if (typeof data48 === "string") {
                                                    if (func2(data48) > 100) {
                                                      const err137 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                                      if (vErrors === null) {
                                                        vErrors = [err137];
                                                      } else {
                                                        vErrors.push(err137);
                                                      }
                                                      errors2++;
                                                    } else {
                                                      if (func2(data48) < 1) {
                                                        const err138 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                                        if (vErrors === null) {
                                                          vErrors = [err138];
                                                        } else {
                                                          vErrors.push(err138);
                                                        }
                                                        errors2++;
                                                      }
                                                    }
                                                  } else {
                                                    const err139 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                    if (vErrors === null) {
                                                      vErrors = [err139];
                                                    } else {
                                                      vErrors.push(err139);
                                                    }
                                                    errors2++;
                                                  }
                                                }
                                                var valid26 = _errs144 === errors2;
                                              } else {
                                                var valid26 = true;
                                              }
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              } else {
                                const err140 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                                if (vErrors === null) {
                                  vErrors = [err140];
                                } else {
                                  vErrors.push(err140);
                                }
                                errors2++;
                              }
                            }
                            var _valid9 = _errs132 === errors2;
                            if (_valid9 && valid20) {
                              valid20 = false;
                              passing1 = [passing1, 5];
                            } else {
                              if (_valid9) {
                                valid20 = true;
                                passing1 = 5;
                                if (props5 !== true) {
                                  props5 = true;
                                }
                              }
                              const _errs146 = errors2;
                              if (errors2 === _errs146) {
                                if (data24 && typeof data24 == "object" && !Array.isArray(data24)) {
                                  let missing14;
                                  if (data24.basis === void 0 && (missing14 = "basis")) {
                                    const err141 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/6/required", keyword: "required", params: { missingProperty: missing14 }, message: "must have required property '" + missing14 + "'" };
                                    if (vErrors === null) {
                                      vErrors = [err141];
                                    } else {
                                      vErrors.push(err141);
                                    }
                                    errors2++;
                                  } else {
                                    const _errs148 = errors2;
                                    for (const key10 in data24) {
                                      if (!(key10 === "basis")) {
                                        const err142 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/6/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key10 }, message: "must NOT have additional properties" };
                                        if (vErrors === null) {
                                          vErrors = [err142];
                                        } else {
                                          vErrors.push(err142);
                                        }
                                        errors2++;
                                        break;
                                      }
                                    }
                                    if (_errs148 === errors2) {
                                      if (data24.basis !== void 0) {
                                        if ("unbounded" !== data24.basis) {
                                          const err143 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/6/properties/basis/const", keyword: "const", params: { allowedValue: "unbounded" }, message: "must be equal to constant" };
                                          if (vErrors === null) {
                                            vErrors = [err143];
                                          } else {
                                            vErrors.push(err143);
                                          }
                                          errors2++;
                                        }
                                      }
                                    }
                                  }
                                } else {
                                  const err144 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/6/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                                  if (vErrors === null) {
                                    vErrors = [err144];
                                  } else {
                                    vErrors.push(err144);
                                  }
                                  errors2++;
                                }
                              }
                              var _valid9 = _errs146 === errors2;
                              if (_valid9 && valid20) {
                                valid20 = false;
                                passing1 = [passing1, 6];
                              } else {
                                if (_valid9) {
                                  valid20 = true;
                                  passing1 = 6;
                                  if (props5 !== true) {
                                    props5 = true;
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                    if (!valid20) {
                      const err145 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf", keyword: "oneOf", params: { passingSchemas: passing1 }, message: "must match exactly one schema in oneOf" };
                      if (vErrors === null) {
                        vErrors = [err145];
                      } else {
                        vErrors.push(err145);
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
                    var _valid8 = _errs83 === errors2;
                    valid18 = valid18 || _valid8;
                    const _errs150 = errors2;
                    if (data24 !== null) {
                      const err146 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/properties/windowRequest/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                      if (vErrors === null) {
                        vErrors = [err146];
                      } else {
                        vErrors.push(err146);
                      }
                      errors2++;
                    }
                    var _valid8 = _errs150 === errors2;
                    valid18 = valid18 || _valid8;
                    if (!valid18) {
                      const err147 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/properties/windowRequest/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                      if (vErrors === null) {
                        vErrors = [err147];
                      } else {
                        vErrors.push(err147);
                      }
                      errors2++;
                      validate40.errors = vErrors;
                      return false;
                    } else {
                      errors2 = _errs82;
                      if (vErrors !== null) {
                        if (_errs82) {
                          vErrors.length = _errs82;
                        } else {
                          vErrors = null;
                        }
                      }
                    }
                    var valid9 = _errs81 === errors2;
                  } else {
                    var valid9 = true;
                  }
                  if (valid9) {
                    if (data.modelSelection !== void 0) {
                      let data50 = data.modelSelection;
                      const _errs152 = errors2;
                      if (errors2 === _errs152) {
                        if (data50 && typeof data50 == "object" && !Array.isArray(data50)) {
                          let missing15;
                          if (data50.provider === void 0 && (missing15 = "provider") || data50.modelId === void 0 && (missing15 = "modelId") || data50.effort === void 0 && (missing15 = "effort")) {
                            validate40.errors = [{ instancePath: instancePath + "/modelSelection", schemaPath: "#/properties/modelSelection/required", keyword: "required", params: { missingProperty: missing15 }, message: "must have required property '" + missing15 + "'" }];
                            return false;
                          } else {
                            const _errs154 = errors2;
                            for (const key11 in data50) {
                              if (!(key11 === "provider" || key11 === "modelId" || key11 === "effort")) {
                                validate40.errors = [{ instancePath: instancePath + "/modelSelection", schemaPath: "#/properties/modelSelection/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key11 }, message: "must NOT have additional properties" }];
                                return false;
                                break;
                              }
                            }
                            if (_errs154 === errors2) {
                              if (data50.provider !== void 0) {
                                let data51 = data50.provider;
                                const _errs155 = errors2;
                                if (!(data51 === "bedrock" || data51 === "claude-api")) {
                                  validate40.errors = [{ instancePath: instancePath + "/modelSelection/provider", schemaPath: "#/properties/modelSelection/properties/provider/enum", keyword: "enum", params: { allowedValues: schema38.properties.modelSelection.properties.provider.enum }, message: "must be equal to one of the allowed values" }];
                                  return false;
                                }
                                var valid28 = _errs155 === errors2;
                              } else {
                                var valid28 = true;
                              }
                              if (valid28) {
                                if (data50.modelId !== void 0) {
                                  let data52 = data50.modelId;
                                  const _errs156 = errors2;
                                  if (errors2 === _errs156) {
                                    if (typeof data52 === "string") {
                                      if (!pattern11.test(data52)) {
                                        validate40.errors = [{ instancePath: instancePath + "/modelSelection/modelId", schemaPath: "#/properties/modelSelection/properties/modelId/pattern", keyword: "pattern", params: { pattern: "^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$" }, message: 'must match pattern "^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$"' }];
                                        return false;
                                      }
                                    } else {
                                      validate40.errors = [{ instancePath: instancePath + "/modelSelection/modelId", schemaPath: "#/properties/modelSelection/properties/modelId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                      return false;
                                    }
                                  }
                                  var valid28 = _errs156 === errors2;
                                } else {
                                  var valid28 = true;
                                }
                                if (valid28) {
                                  if (data50.effort !== void 0) {
                                    let data53 = data50.effort;
                                    const _errs158 = errors2;
                                    const _errs159 = errors2;
                                    let valid29 = false;
                                    const _errs160 = errors2;
                                    if (data53 !== null) {
                                      const err148 = { instancePath: instancePath + "/modelSelection/effort", schemaPath: "#/properties/modelSelection/properties/effort/anyOf/0/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                      if (vErrors === null) {
                                        vErrors = [err148];
                                      } else {
                                        vErrors.push(err148);
                                      }
                                      errors2++;
                                    }
                                    var _valid10 = _errs160 === errors2;
                                    valid29 = valid29 || _valid10;
                                    const _errs162 = errors2;
                                    if (typeof data53 !== "string") {
                                      const err149 = { instancePath: instancePath + "/modelSelection/effort", schemaPath: "#/properties/modelSelection/properties/effort/anyOf/1/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                      if (vErrors === null) {
                                        vErrors = [err149];
                                      } else {
                                        vErrors.push(err149);
                                      }
                                      errors2++;
                                    }
                                    if (!(data53 === "low" || data53 === "medium" || data53 === "high" || data53 === "xhigh" || data53 === "max")) {
                                      const err150 = { instancePath: instancePath + "/modelSelection/effort", schemaPath: "#/properties/modelSelection/properties/effort/anyOf/1/enum", keyword: "enum", params: { allowedValues: schema38.properties.modelSelection.properties.effort.anyOf[1].enum }, message: "must be equal to one of the allowed values" };
                                      if (vErrors === null) {
                                        vErrors = [err150];
                                      } else {
                                        vErrors.push(err150);
                                      }
                                      errors2++;
                                    }
                                    var _valid10 = _errs162 === errors2;
                                    valid29 = valid29 || _valid10;
                                    if (!valid29) {
                                      const err151 = { instancePath: instancePath + "/modelSelection/effort", schemaPath: "#/properties/modelSelection/properties/effort/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                      if (vErrors === null) {
                                        vErrors = [err151];
                                      } else {
                                        vErrors.push(err151);
                                      }
                                      errors2++;
                                      validate40.errors = vErrors;
                                      return false;
                                    } else {
                                      errors2 = _errs159;
                                      if (vErrors !== null) {
                                        if (_errs159) {
                                          vErrors.length = _errs159;
                                        } else {
                                          vErrors = null;
                                        }
                                      }
                                    }
                                    var valid28 = _errs158 === errors2;
                                  } else {
                                    var valid28 = true;
                                  }
                                }
                              }
                            }
                          }
                        } else {
                          validate40.errors = [{ instancePath: instancePath + "/modelSelection", schemaPath: "#/properties/modelSelection/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                          return false;
                        }
                      }
                      var valid9 = _errs152 === errors2;
                    } else {
                      var valid9 = true;
                    }
                    if (valid9) {
                      if (data.documentRevision !== void 0) {
                        let data54 = data.documentRevision;
                        const _errs164 = errors2;
                        if (errors2 === _errs164) {
                          if (data54 && typeof data54 == "object" && !Array.isArray(data54)) {
                            let missing16;
                            if (data54.artifactId === void 0 && (missing16 = "artifactId") || data54.versionId === void 0 && (missing16 = "versionId") || data54.objectSha256 === void 0 && (missing16 = "objectSha256")) {
                              validate40.errors = [{ instancePath: instancePath + "/documentRevision", schemaPath: "#/properties/documentRevision/required", keyword: "required", params: { missingProperty: missing16 }, message: "must have required property '" + missing16 + "'" }];
                              return false;
                            } else {
                              const _errs166 = errors2;
                              for (const key12 in data54) {
                                if (!(key12 === "artifactId" || key12 === "versionId" || key12 === "objectSha256")) {
                                  validate40.errors = [{ instancePath: instancePath + "/documentRevision", schemaPath: "#/properties/documentRevision/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key12 }, message: "must NOT have additional properties" }];
                                  return false;
                                  break;
                                }
                              }
                              if (_errs166 === errors2) {
                                if (data54.artifactId !== void 0) {
                                  let data55 = data54.artifactId;
                                  const _errs167 = errors2;
                                  if (errors2 === _errs167) {
                                    if (typeof data55 === "string") {
                                      if (!pattern4.test(data55)) {
                                        validate40.errors = [{ instancePath: instancePath + "/documentRevision/artifactId", schemaPath: "#/properties/documentRevision/properties/artifactId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' }];
                                        return false;
                                      }
                                    } else {
                                      validate40.errors = [{ instancePath: instancePath + "/documentRevision/artifactId", schemaPath: "#/properties/documentRevision/properties/artifactId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                      return false;
                                    }
                                  }
                                  var valid30 = _errs167 === errors2;
                                } else {
                                  var valid30 = true;
                                }
                                if (valid30) {
                                  if (data54.versionId !== void 0) {
                                    let data56 = data54.versionId;
                                    const _errs169 = errors2;
                                    if (errors2 === _errs169) {
                                      if (typeof data56 === "string") {
                                        if (!pattern4.test(data56)) {
                                          validate40.errors = [{ instancePath: instancePath + "/documentRevision/versionId", schemaPath: "#/properties/documentRevision/properties/versionId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' }];
                                          return false;
                                        }
                                      } else {
                                        validate40.errors = [{ instancePath: instancePath + "/documentRevision/versionId", schemaPath: "#/properties/documentRevision/properties/versionId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                        return false;
                                      }
                                    }
                                    var valid30 = _errs169 === errors2;
                                  } else {
                                    var valid30 = true;
                                  }
                                  if (valid30) {
                                    if (data54.objectSha256 !== void 0) {
                                      let data57 = data54.objectSha256;
                                      const _errs171 = errors2;
                                      if (errors2 === _errs171) {
                                        if (typeof data57 === "string") {
                                          if (!pattern14.test(data57)) {
                                            validate40.errors = [{ instancePath: instancePath + "/documentRevision/objectSha256", schemaPath: "#/properties/documentRevision/properties/objectSha256/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{64}$" }, message: 'must match pattern "^[0-9a-f]{64}$"' }];
                                            return false;
                                          }
                                        } else {
                                          validate40.errors = [{ instancePath: instancePath + "/documentRevision/objectSha256", schemaPath: "#/properties/documentRevision/properties/objectSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                          return false;
                                        }
                                      }
                                      var valid30 = _errs171 === errors2;
                                    } else {
                                      var valid30 = true;
                                    }
                                  }
                                }
                              }
                            }
                          } else {
                            validate40.errors = [{ instancePath: instancePath + "/documentRevision", schemaPath: "#/properties/documentRevision/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                            return false;
                          }
                        }
                        var valid9 = _errs164 === errors2;
                      } else {
                        var valid9 = true;
                      }
                      if (valid9) {
                        if (data.uploads !== void 0) {
                          let data58 = data.uploads;
                          const _errs173 = errors2;
                          if (errors2 === _errs173) {
                            if (Array.isArray(data58)) {
                              if (data58.length > 8) {
                                validate40.errors = [{ instancePath: instancePath + "/uploads", schemaPath: "#/properties/uploads/maxItems", keyword: "maxItems", params: { limit: 8 }, message: "must NOT have more than 8 items" }];
                                return false;
                              } else {
                                if (data58.length < 1) {
                                  validate40.errors = [{ instancePath: instancePath + "/uploads", schemaPath: "#/properties/uploads/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                                  return false;
                                } else {
                                  var valid31 = true;
                                  const len0 = data58.length;
                                  for (let i0 = 0; i0 < len0; i0++) {
                                    let data59 = data58[i0];
                                    const _errs175 = errors2;
                                    if (errors2 === _errs175) {
                                      if (data59 && typeof data59 == "object" && !Array.isArray(data59)) {
                                        let missing17;
                                        if (data59.uploadId === void 0 && (missing17 = "uploadId") || data59.sha256 === void 0 && (missing17 = "sha256")) {
                                          validate40.errors = [{ instancePath: instancePath + "/uploads/" + i0, schemaPath: "#/properties/uploads/items/required", keyword: "required", params: { missingProperty: missing17 }, message: "must have required property '" + missing17 + "'" }];
                                          return false;
                                        } else {
                                          const _errs177 = errors2;
                                          for (const key13 in data59) {
                                            if (!(key13 === "uploadId" || key13 === "sha256")) {
                                              validate40.errors = [{ instancePath: instancePath + "/uploads/" + i0, schemaPath: "#/properties/uploads/items/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key13 }, message: "must NOT have additional properties" }];
                                              return false;
                                              break;
                                            }
                                          }
                                          if (_errs177 === errors2) {
                                            if (data59.uploadId !== void 0) {
                                              let data60 = data59.uploadId;
                                              const _errs178 = errors2;
                                              if (errors2 === _errs178) {
                                                if (typeof data60 === "string") {
                                                  if (!pattern4.test(data60)) {
                                                    validate40.errors = [{ instancePath: instancePath + "/uploads/" + i0 + "/uploadId", schemaPath: "#/properties/uploads/items/properties/uploadId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' }];
                                                    return false;
                                                  }
                                                } else {
                                                  validate40.errors = [{ instancePath: instancePath + "/uploads/" + i0 + "/uploadId", schemaPath: "#/properties/uploads/items/properties/uploadId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                  return false;
                                                }
                                              }
                                              var valid32 = _errs178 === errors2;
                                            } else {
                                              var valid32 = true;
                                            }
                                            if (valid32) {
                                              if (data59.sha256 !== void 0) {
                                                let data61 = data59.sha256;
                                                const _errs180 = errors2;
                                                if (errors2 === _errs180) {
                                                  if (typeof data61 === "string") {
                                                    if (!pattern14.test(data61)) {
                                                      validate40.errors = [{ instancePath: instancePath + "/uploads/" + i0 + "/sha256", schemaPath: "#/properties/uploads/items/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{64}$" }, message: 'must match pattern "^[0-9a-f]{64}$"' }];
                                                      return false;
                                                    }
                                                  } else {
                                                    validate40.errors = [{ instancePath: instancePath + "/uploads/" + i0 + "/sha256", schemaPath: "#/properties/uploads/items/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                    return false;
                                                  }
                                                }
                                                var valid32 = _errs180 === errors2;
                                              } else {
                                                var valid32 = true;
                                              }
                                            }
                                          }
                                        }
                                      } else {
                                        validate40.errors = [{ instancePath: instancePath + "/uploads/" + i0, schemaPath: "#/properties/uploads/items/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                        return false;
                                      }
                                    }
                                    var valid31 = _errs175 === errors2;
                                    if (!valid31) {
                                      break;
                                    }
                                  }
                                  if (valid31) {
                                    let i1 = data58.length;
                                    let j0;
                                    if (i1 > 1) {
                                      outer0: for (; i1--; ) {
                                        for (j0 = i1; j0--; ) {
                                          if (func0(data58[i1], data58[j0])) {
                                            validate40.errors = [{ instancePath: instancePath + "/uploads", schemaPath: "#/properties/uploads/uniqueItems", keyword: "uniqueItems", params: { i: i1, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)" }];
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
                              validate40.errors = [{ instancePath: instancePath + "/uploads", schemaPath: "#/properties/uploads/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                              return false;
                            }
                          }
                          var valid9 = _errs173 === errors2;
                        } else {
                          var valid9 = true;
                        }
                        if (valid9) {
                          if (data.procedure !== void 0) {
                            let data62 = data.procedure;
                            const _errs182 = errors2;
                            const _errs183 = errors2;
                            let valid34 = false;
                            let passing2 = null;
                            const _errs184 = errors2;
                            if (errors2 === _errs184) {
                              if (data62 && typeof data62 == "object" && !Array.isArray(data62)) {
                                let missing18;
                                if (data62.source === void 0 && (missing18 = "source") || data62.recordId === void 0 && (missing18 = "recordId") || data62.version === void 0 && (missing18 = "version") || data62.manifestDigest === void 0 && (missing18 = "manifestDigest")) {
                                  const err152 = { instancePath: instancePath + "/procedure", schemaPath: "#/properties/procedure/oneOf/0/required", keyword: "required", params: { missingProperty: missing18 }, message: "must have required property '" + missing18 + "'" };
                                  if (vErrors === null) {
                                    vErrors = [err152];
                                  } else {
                                    vErrors.push(err152);
                                  }
                                  errors2++;
                                } else {
                                  const _errs186 = errors2;
                                  for (const key14 in data62) {
                                    if (!(key14 === "source" || key14 === "recordId" || key14 === "version" || key14 === "manifestDigest")) {
                                      const err153 = { instancePath: instancePath + "/procedure", schemaPath: "#/properties/procedure/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key14 }, message: "must NOT have additional properties" };
                                      if (vErrors === null) {
                                        vErrors = [err153];
                                      } else {
                                        vErrors.push(err153);
                                      }
                                      errors2++;
                                      break;
                                    }
                                  }
                                  if (_errs186 === errors2) {
                                    if (data62.source !== void 0) {
                                      const _errs187 = errors2;
                                      if ("firm" !== data62.source) {
                                        const err154 = { instancePath: instancePath + "/procedure/source", schemaPath: "#/properties/procedure/oneOf/0/properties/source/const", keyword: "const", params: { allowedValue: "firm" }, message: "must be equal to constant" };
                                        if (vErrors === null) {
                                          vErrors = [err154];
                                        } else {
                                          vErrors.push(err154);
                                        }
                                        errors2++;
                                      }
                                      var valid35 = _errs187 === errors2;
                                    } else {
                                      var valid35 = true;
                                    }
                                    if (valid35) {
                                      if (data62.recordId !== void 0) {
                                        let data64 = data62.recordId;
                                        const _errs188 = errors2;
                                        if (errors2 === _errs188) {
                                          if (typeof data64 === "string") {
                                            if (!pattern4.test(data64)) {
                                              const err155 = { instancePath: instancePath + "/procedure/recordId", schemaPath: "#/properties/procedure/oneOf/0/properties/recordId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' };
                                              if (vErrors === null) {
                                                vErrors = [err155];
                                              } else {
                                                vErrors.push(err155);
                                              }
                                              errors2++;
                                            }
                                          } else {
                                            const err156 = { instancePath: instancePath + "/procedure/recordId", schemaPath: "#/properties/procedure/oneOf/0/properties/recordId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                            if (vErrors === null) {
                                              vErrors = [err156];
                                            } else {
                                              vErrors.push(err156);
                                            }
                                            errors2++;
                                          }
                                        }
                                        var valid35 = _errs188 === errors2;
                                      } else {
                                        var valid35 = true;
                                      }
                                      if (valid35) {
                                        if (data62.version !== void 0) {
                                          let data65 = data62.version;
                                          const _errs190 = errors2;
                                          if (!(typeof data65 == "number" && (!(data65 % 1) && !isNaN(data65)) && isFinite(data65))) {
                                            const err157 = { instancePath: instancePath + "/procedure/version", schemaPath: "#/properties/procedure/oneOf/0/properties/version/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                            if (vErrors === null) {
                                              vErrors = [err157];
                                            } else {
                                              vErrors.push(err157);
                                            }
                                            errors2++;
                                          }
                                          if (errors2 === _errs190) {
                                            if (typeof data65 == "number" && isFinite(data65)) {
                                              if (data65 > 9007199254740991 || isNaN(data65)) {
                                                const err158 = { instancePath: instancePath + "/procedure/version", schemaPath: "#/properties/procedure/oneOf/0/properties/version/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                                if (vErrors === null) {
                                                  vErrors = [err158];
                                                } else {
                                                  vErrors.push(err158);
                                                }
                                                errors2++;
                                              } else {
                                                if (data65 < 1 || isNaN(data65)) {
                                                  const err159 = { instancePath: instancePath + "/procedure/version", schemaPath: "#/properties/procedure/oneOf/0/properties/version/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                                                  if (vErrors === null) {
                                                    vErrors = [err159];
                                                  } else {
                                                    vErrors.push(err159);
                                                  }
                                                  errors2++;
                                                }
                                              }
                                            }
                                          }
                                          var valid35 = _errs190 === errors2;
                                        } else {
                                          var valid35 = true;
                                        }
                                        if (valid35) {
                                          if (data62.manifestDigest !== void 0) {
                                            let data66 = data62.manifestDigest;
                                            const _errs192 = errors2;
                                            if (errors2 === _errs192) {
                                              if (typeof data66 === "string") {
                                                if (!pattern18.test(data66)) {
                                                  const err160 = { instancePath: instancePath + "/procedure/manifestDigest", schemaPath: "#/properties/procedure/oneOf/0/properties/manifestDigest/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' };
                                                  if (vErrors === null) {
                                                    vErrors = [err160];
                                                  } else {
                                                    vErrors.push(err160);
                                                  }
                                                  errors2++;
                                                }
                                              } else {
                                                const err161 = { instancePath: instancePath + "/procedure/manifestDigest", schemaPath: "#/properties/procedure/oneOf/0/properties/manifestDigest/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                if (vErrors === null) {
                                                  vErrors = [err161];
                                                } else {
                                                  vErrors.push(err161);
                                                }
                                                errors2++;
                                              }
                                            }
                                            var valid35 = _errs192 === errors2;
                                          } else {
                                            var valid35 = true;
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              } else {
                                const err162 = { instancePath: instancePath + "/procedure", schemaPath: "#/properties/procedure/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                                if (vErrors === null) {
                                  vErrors = [err162];
                                } else {
                                  vErrors.push(err162);
                                }
                                errors2++;
                              }
                            }
                            var _valid11 = _errs184 === errors2;
                            if (_valid11) {
                              valid34 = true;
                              passing2 = 0;
                              var props6 = true;
                            }
                            const _errs194 = errors2;
                            if (errors2 === _errs194) {
                              if (data62 && typeof data62 == "object" && !Array.isArray(data62)) {
                                let missing19;
                                if (data62.source === void 0 && (missing19 = "source") || data62.id === void 0 && (missing19 = "id") || data62.version === void 0 && (missing19 = "version") || data62.manifestDigest === void 0 && (missing19 = "manifestDigest")) {
                                  const err163 = { instancePath: instancePath + "/procedure", schemaPath: "#/properties/procedure/oneOf/1/required", keyword: "required", params: { missingProperty: missing19 }, message: "must have required property '" + missing19 + "'" };
                                  if (vErrors === null) {
                                    vErrors = [err163];
                                  } else {
                                    vErrors.push(err163);
                                  }
                                  errors2++;
                                } else {
                                  const _errs196 = errors2;
                                  for (const key15 in data62) {
                                    if (!(key15 === "source" || key15 === "id" || key15 === "version" || key15 === "manifestDigest")) {
                                      const err164 = { instancePath: instancePath + "/procedure", schemaPath: "#/properties/procedure/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key15 }, message: "must NOT have additional properties" };
                                      if (vErrors === null) {
                                        vErrors = [err164];
                                      } else {
                                        vErrors.push(err164);
                                      }
                                      errors2++;
                                      break;
                                    }
                                  }
                                  if (_errs196 === errors2) {
                                    if (data62.source !== void 0) {
                                      const _errs197 = errors2;
                                      if ("builtin" !== data62.source) {
                                        const err165 = { instancePath: instancePath + "/procedure/source", schemaPath: "#/properties/procedure/oneOf/1/properties/source/const", keyword: "const", params: { allowedValue: "builtin" }, message: "must be equal to constant" };
                                        if (vErrors === null) {
                                          vErrors = [err165];
                                        } else {
                                          vErrors.push(err165);
                                        }
                                        errors2++;
                                      }
                                      var valid36 = _errs197 === errors2;
                                    } else {
                                      var valid36 = true;
                                    }
                                    if (valid36) {
                                      if (data62.id !== void 0) {
                                        let data68 = data62.id;
                                        const _errs198 = errors2;
                                        if (!(data68 === "briefing" || data68 === "draft" || data68 === "bill_analysis" || data68 === "hearing_prep" || data68 === "coalition_letter" || data68 === "amendment_tracker")) {
                                          const err166 = { instancePath: instancePath + "/procedure/id", schemaPath: "#/properties/procedure/oneOf/1/properties/id/enum", keyword: "enum", params: { allowedValues: schema38.properties.procedure.oneOf[1].properties.id.enum }, message: "must be equal to one of the allowed values" };
                                          if (vErrors === null) {
                                            vErrors = [err166];
                                          } else {
                                            vErrors.push(err166);
                                          }
                                          errors2++;
                                        }
                                        var valid36 = _errs198 === errors2;
                                      } else {
                                        var valid36 = true;
                                      }
                                      if (valid36) {
                                        if (data62.version !== void 0) {
                                          let data69 = data62.version;
                                          const _errs199 = errors2;
                                          if (!(typeof data69 == "number" && (!(data69 % 1) && !isNaN(data69)) && isFinite(data69))) {
                                            const err167 = { instancePath: instancePath + "/procedure/version", schemaPath: "#/properties/procedure/oneOf/1/properties/version/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                            if (vErrors === null) {
                                              vErrors = [err167];
                                            } else {
                                              vErrors.push(err167);
                                            }
                                            errors2++;
                                          }
                                          if (errors2 === _errs199) {
                                            if (typeof data69 == "number" && isFinite(data69)) {
                                              if (data69 > 9007199254740991 || isNaN(data69)) {
                                                const err168 = { instancePath: instancePath + "/procedure/version", schemaPath: "#/properties/procedure/oneOf/1/properties/version/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                                if (vErrors === null) {
                                                  vErrors = [err168];
                                                } else {
                                                  vErrors.push(err168);
                                                }
                                                errors2++;
                                              } else {
                                                if (data69 < 1 || isNaN(data69)) {
                                                  const err169 = { instancePath: instancePath + "/procedure/version", schemaPath: "#/properties/procedure/oneOf/1/properties/version/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                                                  if (vErrors === null) {
                                                    vErrors = [err169];
                                                  } else {
                                                    vErrors.push(err169);
                                                  }
                                                  errors2++;
                                                }
                                              }
                                            }
                                          }
                                          var valid36 = _errs199 === errors2;
                                        } else {
                                          var valid36 = true;
                                        }
                                        if (valid36) {
                                          if (data62.manifestDigest !== void 0) {
                                            let data70 = data62.manifestDigest;
                                            const _errs201 = errors2;
                                            if (errors2 === _errs201) {
                                              if (typeof data70 === "string") {
                                                if (!pattern18.test(data70)) {
                                                  const err170 = { instancePath: instancePath + "/procedure/manifestDigest", schemaPath: "#/properties/procedure/oneOf/1/properties/manifestDigest/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' };
                                                  if (vErrors === null) {
                                                    vErrors = [err170];
                                                  } else {
                                                    vErrors.push(err170);
                                                  }
                                                  errors2++;
                                                }
                                              } else {
                                                const err171 = { instancePath: instancePath + "/procedure/manifestDigest", schemaPath: "#/properties/procedure/oneOf/1/properties/manifestDigest/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                if (vErrors === null) {
                                                  vErrors = [err171];
                                                } else {
                                                  vErrors.push(err171);
                                                }
                                                errors2++;
                                              }
                                            }
                                            var valid36 = _errs201 === errors2;
                                          } else {
                                            var valid36 = true;
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              } else {
                                const err172 = { instancePath: instancePath + "/procedure", schemaPath: "#/properties/procedure/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                                if (vErrors === null) {
                                  vErrors = [err172];
                                } else {
                                  vErrors.push(err172);
                                }
                                errors2++;
                              }
                            }
                            var _valid11 = _errs194 === errors2;
                            if (_valid11 && valid34) {
                              valid34 = false;
                              passing2 = [passing2, 1];
                            } else {
                              if (_valid11) {
                                valid34 = true;
                                passing2 = 1;
                                if (props6 !== true) {
                                  props6 = true;
                                }
                              }
                            }
                            if (!valid34) {
                              const err173 = { instancePath: instancePath + "/procedure", schemaPath: "#/properties/procedure/oneOf", keyword: "oneOf", params: { passingSchemas: passing2 }, message: "must match exactly one schema in oneOf" };
                              if (vErrors === null) {
                                vErrors = [err173];
                              } else {
                                vErrors.push(err173);
                              }
                              errors2++;
                              validate40.errors = vErrors;
                              return false;
                            } else {
                              errors2 = _errs183;
                              if (vErrors !== null) {
                                if (_errs183) {
                                  vErrors.length = _errs183;
                                } else {
                                  vErrors = null;
                                }
                              }
                            }
                            var valid9 = _errs182 === errors2;
                          } else {
                            var valid9 = true;
                          }
                          if (valid9) {
                            if (data.siteWorkflow !== void 0) {
                              let data71 = data.siteWorkflow;
                              const _errs203 = errors2;
                              if (errors2 === _errs203) {
                                if (data71 && typeof data71 == "object" && !Array.isArray(data71)) {
                                  let missing20;
                                  if (data71.siteId === void 0 && (missing20 = "siteId") || data71.workflowId === void 0 && (missing20 = "workflowId") || data71.version === void 0 && (missing20 = "version") || data71.manifestSha256 === void 0 && (missing20 = "manifestSha256")) {
                                    validate40.errors = [{ instancePath: instancePath + "/siteWorkflow", schemaPath: "#/properties/siteWorkflow/required", keyword: "required", params: { missingProperty: missing20 }, message: "must have required property '" + missing20 + "'" }];
                                    return false;
                                  } else {
                                    const _errs205 = errors2;
                                    for (const key16 in data71) {
                                      if (!(key16 === "siteId" || key16 === "workflowId" || key16 === "version" || key16 === "manifestSha256")) {
                                        validate40.errors = [{ instancePath: instancePath + "/siteWorkflow", schemaPath: "#/properties/siteWorkflow/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key16 }, message: "must NOT have additional properties" }];
                                        return false;
                                        break;
                                      }
                                    }
                                    if (_errs205 === errors2) {
                                      if (data71.siteId !== void 0) {
                                        let data72 = data71.siteId;
                                        const _errs206 = errors2;
                                        if (errors2 === _errs206) {
                                          if (typeof data72 === "string") {
                                            if (!pattern20.test(data72)) {
                                              validate40.errors = [{ instancePath: instancePath + "/siteWorkflow/siteId", schemaPath: "#/properties/siteWorkflow/properties/siteId/pattern", keyword: "pattern", params: { pattern: "^[a-z][a-z0-9-]{1,63}$" }, message: 'must match pattern "^[a-z][a-z0-9-]{1,63}$"' }];
                                              return false;
                                            }
                                          } else {
                                            validate40.errors = [{ instancePath: instancePath + "/siteWorkflow/siteId", schemaPath: "#/properties/siteWorkflow/properties/siteId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                            return false;
                                          }
                                        }
                                        var valid37 = _errs206 === errors2;
                                      } else {
                                        var valid37 = true;
                                      }
                                      if (valid37) {
                                        if (data71.workflowId !== void 0) {
                                          let data73 = data71.workflowId;
                                          const _errs208 = errors2;
                                          if (errors2 === _errs208) {
                                            if (typeof data73 === "string") {
                                              if (!pattern20.test(data73)) {
                                                validate40.errors = [{ instancePath: instancePath + "/siteWorkflow/workflowId", schemaPath: "#/properties/siteWorkflow/properties/workflowId/pattern", keyword: "pattern", params: { pattern: "^[a-z][a-z0-9-]{1,63}$" }, message: 'must match pattern "^[a-z][a-z0-9-]{1,63}$"' }];
                                                return false;
                                              }
                                            } else {
                                              validate40.errors = [{ instancePath: instancePath + "/siteWorkflow/workflowId", schemaPath: "#/properties/siteWorkflow/properties/workflowId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                              return false;
                                            }
                                          }
                                          var valid37 = _errs208 === errors2;
                                        } else {
                                          var valid37 = true;
                                        }
                                        if (valid37) {
                                          if (data71.version !== void 0) {
                                            let data74 = data71.version;
                                            const _errs210 = errors2;
                                            if (!(typeof data74 == "number" && (!(data74 % 1) && !isNaN(data74)) && isFinite(data74))) {
                                              validate40.errors = [{ instancePath: instancePath + "/siteWorkflow/version", schemaPath: "#/properties/siteWorkflow/properties/version/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                              return false;
                                            }
                                            if (errors2 === _errs210) {
                                              if (typeof data74 == "number" && isFinite(data74)) {
                                                if (data74 > 9007199254740991 || isNaN(data74)) {
                                                  validate40.errors = [{ instancePath: instancePath + "/siteWorkflow/version", schemaPath: "#/properties/siteWorkflow/properties/version/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                  return false;
                                                } else {
                                                  if (data74 < 1 || isNaN(data74)) {
                                                    validate40.errors = [{ instancePath: instancePath + "/siteWorkflow/version", schemaPath: "#/properties/siteWorkflow/properties/version/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                                                    return false;
                                                  }
                                                }
                                              }
                                            }
                                            var valid37 = _errs210 === errors2;
                                          } else {
                                            var valid37 = true;
                                          }
                                          if (valid37) {
                                            if (data71.manifestSha256 !== void 0) {
                                              let data75 = data71.manifestSha256;
                                              const _errs212 = errors2;
                                              if (errors2 === _errs212) {
                                                if (typeof data75 === "string") {
                                                  if (!pattern18.test(data75)) {
                                                    validate40.errors = [{ instancePath: instancePath + "/siteWorkflow/manifestSha256", schemaPath: "#/properties/siteWorkflow/properties/manifestSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                                    return false;
                                                  }
                                                } else {
                                                  validate40.errors = [{ instancePath: instancePath + "/siteWorkflow/manifestSha256", schemaPath: "#/properties/siteWorkflow/properties/manifestSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                  return false;
                                                }
                                              }
                                              var valid37 = _errs212 === errors2;
                                            } else {
                                              var valid37 = true;
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }
                                } else {
                                  validate40.errors = [{ instancePath: instancePath + "/siteWorkflow", schemaPath: "#/properties/siteWorkflow/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                  return false;
                                }
                              }
                              var valid9 = _errs203 === errors2;
                            } else {
                              var valid9 = true;
                            }
                            if (valid9) {
                              if (data.work !== void 0) {
                                let data76 = data.work;
                                const _errs214 = errors2;
                                if (errors2 === _errs214) {
                                  if (data76 && typeof data76 == "object" && !Array.isArray(data76)) {
                                    let missing21;
                                    if (data76.entry === void 0 && (missing21 = "entry") || data76.jobKind === void 0 && (missing21 = "jobKind") || data76.deliverables === void 0 && (missing21 = "deliverables") || data76.dependencies === void 0 && (missing21 = "dependencies")) {
                                      validate40.errors = [{ instancePath: instancePath + "/work", schemaPath: "#/properties/work/required", keyword: "required", params: { missingProperty: missing21 }, message: "must have required property '" + missing21 + "'" }];
                                      return false;
                                    } else {
                                      const _errs216 = errors2;
                                      for (const key17 in data76) {
                                        if (!(key17 === "entry" || key17 === "jobKind" || key17 === "deliverables" || key17 === "dependencies")) {
                                          validate40.errors = [{ instancePath: instancePath + "/work", schemaPath: "#/properties/work/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key17 }, message: "must NOT have additional properties" }];
                                          return false;
                                          break;
                                        }
                                      }
                                      if (_errs216 === errors2) {
                                        if (data76.entry !== void 0) {
                                          let data77 = data76.entry;
                                          const _errs217 = errors2;
                                          if (!(data77 === "start-work" || data77 === "delegate")) {
                                            validate40.errors = [{ instancePath: instancePath + "/work/entry", schemaPath: "#/properties/work/properties/entry/enum", keyword: "enum", params: { allowedValues: schema38.properties.work.properties.entry.enum }, message: "must be equal to one of the allowed values" }];
                                            return false;
                                          }
                                          var valid38 = _errs217 === errors2;
                                        } else {
                                          var valid38 = true;
                                        }
                                        if (valid38) {
                                          if (data76.jobKind !== void 0) {
                                            let data78 = data76.jobKind;
                                            const _errs218 = errors2;
                                            if (!(data78 === "research" || data78 === "deliverable" || data78 === "audit" || data78 === "scheduled")) {
                                              validate40.errors = [{ instancePath: instancePath + "/work/jobKind", schemaPath: "#/properties/work/properties/jobKind/enum", keyword: "enum", params: { allowedValues: schema38.properties.work.properties.jobKind.enum }, message: "must be equal to one of the allowed values" }];
                                              return false;
                                            }
                                            var valid38 = _errs218 === errors2;
                                          } else {
                                            var valid38 = true;
                                          }
                                          if (valid38) {
                                            if (data76.deliverables !== void 0) {
                                              let data79 = data76.deliverables;
                                              const _errs219 = errors2;
                                              if (errors2 === _errs219) {
                                                if (Array.isArray(data79)) {
                                                  if (data79.length > 20) {
                                                    validate40.errors = [{ instancePath: instancePath + "/work/deliverables", schemaPath: "#/properties/work/properties/deliverables/maxItems", keyword: "maxItems", params: { limit: 20 }, message: "must NOT have more than 20 items" }];
                                                    return false;
                                                  } else {
                                                    var valid39 = true;
                                                    const len1 = data79.length;
                                                    for (let i2 = 0; i2 < len1; i2++) {
                                                      let data80 = data79[i2];
                                                      const _errs221 = errors2;
                                                      if (errors2 === _errs221) {
                                                        if (typeof data80 === "string") {
                                                          if (func2(data80) > 200) {
                                                            validate40.errors = [{ instancePath: instancePath + "/work/deliverables/" + i2, schemaPath: "#/properties/work/properties/deliverables/items/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" }];
                                                            return false;
                                                          } else {
                                                            if (func2(data80) < 1) {
                                                              validate40.errors = [{ instancePath: instancePath + "/work/deliverables/" + i2, schemaPath: "#/properties/work/properties/deliverables/items/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                              return false;
                                                            } else {
                                                              if (!pattern5.test(data80)) {
                                                                validate40.errors = [{ instancePath: instancePath + "/work/deliverables/" + i2, schemaPath: "#/properties/work/properties/deliverables/items/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "\\S"' }];
                                                                return false;
                                                              }
                                                            }
                                                          }
                                                        } else {
                                                          validate40.errors = [{ instancePath: instancePath + "/work/deliverables/" + i2, schemaPath: "#/properties/work/properties/deliverables/items/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                          return false;
                                                        }
                                                      }
                                                      var valid39 = _errs221 === errors2;
                                                      if (!valid39) {
                                                        break;
                                                      }
                                                    }
                                                    if (valid39) {
                                                      let i3 = data79.length;
                                                      let j1;
                                                      if (i3 > 1) {
                                                        const indices0 = {};
                                                        for (; i3--; ) {
                                                          let item0 = data79[i3];
                                                          if (typeof item0 !== "string") {
                                                            continue;
                                                          }
                                                          if (typeof indices0[item0] == "number") {
                                                            j1 = indices0[item0];
                                                            validate40.errors = [{ instancePath: instancePath + "/work/deliverables", schemaPath: "#/properties/work/properties/deliverables/uniqueItems", keyword: "uniqueItems", params: { i: i3, j: j1 }, message: "must NOT have duplicate items (items ## " + j1 + " and " + i3 + " are identical)" }];
                                                            return false;
                                                            break;
                                                          }
                                                          indices0[item0] = i3;
                                                        }
                                                      }
                                                    }
                                                  }
                                                } else {
                                                  validate40.errors = [{ instancePath: instancePath + "/work/deliverables", schemaPath: "#/properties/work/properties/deliverables/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                                  return false;
                                                }
                                              }
                                              var valid38 = _errs219 === errors2;
                                            } else {
                                              var valid38 = true;
                                            }
                                            if (valid38) {
                                              if (data76.dependencies !== void 0) {
                                                let data81 = data76.dependencies;
                                                const _errs223 = errors2;
                                                if (errors2 === _errs223) {
                                                  if (Array.isArray(data81)) {
                                                    if (data81.length > 20) {
                                                      validate40.errors = [{ instancePath: instancePath + "/work/dependencies", schemaPath: "#/properties/work/properties/dependencies/maxItems", keyword: "maxItems", params: { limit: 20 }, message: "must NOT have more than 20 items" }];
                                                      return false;
                                                    } else {
                                                      var valid41 = true;
                                                      const len2 = data81.length;
                                                      for (let i4 = 0; i4 < len2; i4++) {
                                                        let data82 = data81[i4];
                                                        const _errs225 = errors2;
                                                        if (errors2 === _errs225) {
                                                          if (typeof data82 === "string") {
                                                            if (func2(data82) > 200) {
                                                              validate40.errors = [{ instancePath: instancePath + "/work/dependencies/" + i4, schemaPath: "#/properties/work/properties/dependencies/items/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" }];
                                                              return false;
                                                            } else {
                                                              if (func2(data82) < 1) {
                                                                validate40.errors = [{ instancePath: instancePath + "/work/dependencies/" + i4, schemaPath: "#/properties/work/properties/dependencies/items/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                                return false;
                                                              } else {
                                                                if (!pattern5.test(data82)) {
                                                                  validate40.errors = [{ instancePath: instancePath + "/work/dependencies/" + i4, schemaPath: "#/properties/work/properties/dependencies/items/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "\\S"' }];
                                                                  return false;
                                                                }
                                                              }
                                                            }
                                                          } else {
                                                            validate40.errors = [{ instancePath: instancePath + "/work/dependencies/" + i4, schemaPath: "#/properties/work/properties/dependencies/items/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                            return false;
                                                          }
                                                        }
                                                        var valid41 = _errs225 === errors2;
                                                        if (!valid41) {
                                                          break;
                                                        }
                                                      }
                                                      if (valid41) {
                                                        let i5 = data81.length;
                                                        let j2;
                                                        if (i5 > 1) {
                                                          const indices1 = {};
                                                          for (; i5--; ) {
                                                            let item1 = data81[i5];
                                                            if (typeof item1 !== "string") {
                                                              continue;
                                                            }
                                                            if (typeof indices1[item1] == "number") {
                                                              j2 = indices1[item1];
                                                              validate40.errors = [{ instancePath: instancePath + "/work/dependencies", schemaPath: "#/properties/work/properties/dependencies/uniqueItems", keyword: "uniqueItems", params: { i: i5, j: j2 }, message: "must NOT have duplicate items (items ## " + j2 + " and " + i5 + " are identical)" }];
                                                              return false;
                                                              break;
                                                            }
                                                            indices1[item1] = i5;
                                                          }
                                                        }
                                                      }
                                                    }
                                                  } else {
                                                    validate40.errors = [{ instancePath: instancePath + "/work/dependencies", schemaPath: "#/properties/work/properties/dependencies/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                                    return false;
                                                  }
                                                }
                                                var valid38 = _errs223 === errors2;
                                              } else {
                                                var valid38 = true;
                                              }
                                            }
                                          }
                                        }
                                      }
                                    }
                                  } else {
                                    validate40.errors = [{ instancePath: instancePath + "/work", schemaPath: "#/properties/work/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                    return false;
                                  }
                                }
                                var valid9 = _errs214 === errors2;
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
var formats20 = /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
var pattern55 = new RegExp("^sha256:[a-f0-9]{64}$", "u");
var pattern56 = new RegExp("^[0-9]+\\.[0-9]+\\.[0-9]+$", "u");
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
                          if (func2(data1) > 128) {
                            validate31.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                            return false;
                          } else {
                            if (func2(data1) < 1) {
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
                            if (func2(data2) > 128) {
                              validate31.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                              return false;
                            } else {
                              if (func2(data2) < 1) {
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
                                      if (func2(data11) > 128) {
                                        validate31.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                        return false;
                                      } else {
                                        if (func2(data11) < 1) {
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
                                          if (func2(data13) > 256) {
                                            validate31.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" }];
                                            return false;
                                          } else {
                                            if (func2(data13) < 1) {
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
                                            if (func2(data14) > 128) {
                                              validate31.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                              return false;
                                            } else {
                                              if (func2(data14) < 1) {
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
                        if (func2(data16) < 1) {
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
                                    if (func2(data18) < 1) {
                                      validate31.errors = [{ instancePath: instancePath + "/versions/imageDigest", schemaPath: "#/$defs/Canonical_RuntimeVersions_7edb8efc/properties/imageDigest/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                      return false;
                                    } else {
                                      if (!pattern55.test(data18)) {
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
                                      if (!pattern56.test(data19)) {
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
                                        if (!pattern56.test(data20)) {
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
                                            if (!pattern18.test(data22)) {
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
  const _errs1 = errors2;
  const _errs2 = errors2;
  let valid1 = true;
  const _errs3 = errors2;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    let missing0;
    if (data.documentRevision === void 0 && (missing0 = "documentRevision")) {
      const err0 = {};
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors2++;
    }
  }
  var _valid0 = _errs3 === errors2;
  errors2 = _errs2;
  if (vErrors !== null) {
    if (_errs2) {
      vErrors.length = _errs2;
    } else {
      vErrors = null;
    }
  }
  if (_valid0) {
    const _errs4 = errors2;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.skill !== void 0) {
        let data0 = data.skill;
        const _errs6 = errors2;
        let valid3 = false;
        const _errs7 = errors2;
        const _errs8 = errors2;
        let valid4 = false;
        const _errs9 = errors2;
        if (errors2 === _errs9) {
          if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
            let missing1;
            if (data0.skillId === void 0 && (missing1 = "skillId") || data0.skillVersion === void 0 && (missing1 = "skillVersion")) {
              const err1 = { instancePath: instancePath + "/skill", schemaPath: "#/allOf/0/then/properties/skill/anyOf/0/anyOf/0/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" };
              if (vErrors === null) {
                vErrors = [err1];
              } else {
                vErrors.push(err1);
              }
              errors2++;
            } else {
              if (data0.skillId !== void 0) {
                const _errs11 = errors2;
                if ("quick_skill.bill_watch" !== data0.skillId) {
                  const err2 = { instancePath: instancePath + "/skill/skillId", schemaPath: "#/allOf/0/then/properties/skill/anyOf/0/anyOf/0/properties/skillId/const", keyword: "const", params: { allowedValue: "quick_skill.bill_watch" }, message: "must be equal to constant" };
                  if (vErrors === null) {
                    vErrors = [err2];
                  } else {
                    vErrors.push(err2);
                  }
                  errors2++;
                }
                var valid5 = _errs11 === errors2;
              } else {
                var valid5 = true;
              }
              if (valid5) {
                if (data0.skillVersion !== void 0) {
                  const _errs12 = errors2;
                  if ("2.0.0" !== data0.skillVersion) {
                    const err3 = { instancePath: instancePath + "/skill/skillVersion", schemaPath: "#/allOf/0/then/properties/skill/anyOf/0/anyOf/0/properties/skillVersion/const", keyword: "const", params: { allowedValue: "2.0.0" }, message: "must be equal to constant" };
                    if (vErrors === null) {
                      vErrors = [err3];
                    } else {
                      vErrors.push(err3);
                    }
                    errors2++;
                  }
                  var valid5 = _errs12 === errors2;
                } else {
                  var valid5 = true;
                }
              }
            }
          } else {
            const err4 = { instancePath: instancePath + "/skill", schemaPath: "#/allOf/0/then/properties/skill/anyOf/0/anyOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
            if (vErrors === null) {
              vErrors = [err4];
            } else {
              vErrors.push(err4);
            }
            errors2++;
          }
        }
        var _valid2 = _errs9 === errors2;
        valid4 = valid4 || _valid2;
        if (_valid2) {
          var props0 = {};
          props0.skillId = true;
          props0.skillVersion = true;
        }
        const _errs13 = errors2;
        if (errors2 === _errs13) {
          if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
            let missing2;
            if (data0.skillId === void 0 && (missing2 = "skillId") || data0.skillVersion === void 0 && (missing2 = "skillVersion")) {
              const err5 = { instancePath: instancePath + "/skill", schemaPath: "#/allOf/0/then/properties/skill/anyOf/0/anyOf/1/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" };
              if (vErrors === null) {
                vErrors = [err5];
              } else {
                vErrors.push(err5);
              }
              errors2++;
            } else {
              if (data0.skillId !== void 0) {
                const _errs15 = errors2;
                if ("quick_skill.cited_report" !== data0.skillId) {
                  const err6 = { instancePath: instancePath + "/skill/skillId", schemaPath: "#/allOf/0/then/properties/skill/anyOf/0/anyOf/1/properties/skillId/const", keyword: "const", params: { allowedValue: "quick_skill.cited_report" }, message: "must be equal to constant" };
                  if (vErrors === null) {
                    vErrors = [err6];
                  } else {
                    vErrors.push(err6);
                  }
                  errors2++;
                }
                var valid6 = _errs15 === errors2;
              } else {
                var valid6 = true;
              }
              if (valid6) {
                if (data0.skillVersion !== void 0) {
                  const _errs16 = errors2;
                  if ("1.0.0" !== data0.skillVersion) {
                    const err7 = { instancePath: instancePath + "/skill/skillVersion", schemaPath: "#/allOf/0/then/properties/skill/anyOf/0/anyOf/1/properties/skillVersion/const", keyword: "const", params: { allowedValue: "1.0.0" }, message: "must be equal to constant" };
                    if (vErrors === null) {
                      vErrors = [err7];
                    } else {
                      vErrors.push(err7);
                    }
                    errors2++;
                  }
                  var valid6 = _errs16 === errors2;
                } else {
                  var valid6 = true;
                }
              }
            }
          } else {
            const err8 = { instancePath: instancePath + "/skill", schemaPath: "#/allOf/0/then/properties/skill/anyOf/0/anyOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
            if (vErrors === null) {
              vErrors = [err8];
            } else {
              vErrors.push(err8);
            }
            errors2++;
          }
        }
        var _valid2 = _errs13 === errors2;
        valid4 = valid4 || _valid2;
        if (_valid2) {
          if (props0 !== true) {
            props0 = props0 || {};
            props0.skillId = true;
            props0.skillVersion = true;
          }
        }
        if (!valid4) {
          const err9 = { instancePath: instancePath + "/skill", schemaPath: "#/allOf/0/then/properties/skill/anyOf/0/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors2++;
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
        var _valid1 = _errs7 === errors2;
        valid3 = valid3 || _valid1;
        const _errs17 = errors2;
        if (data0 !== null) {
          const err10 = { instancePath: instancePath + "/skill", schemaPath: "#/allOf/0/then/properties/skill/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors2++;
        }
        var _valid1 = _errs17 === errors2;
        valid3 = valid3 || _valid1;
        if (!valid3) {
          const err11 = { instancePath: instancePath + "/skill", schemaPath: "#/allOf/0/then/properties/skill/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors2++;
          validate33.errors = vErrors;
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
      }
    }
    var _valid0 = _errs4 === errors2;
    valid1 = _valid0;
    if (valid1) {
      var props1 = {};
      props1.skill = true;
      props1.documentRevision = true;
    }
  }
  if (!valid1) {
    const err12 = { instancePath, schemaPath: "#/allOf/0/if", keyword: "if", params: { failingKeyword: "then" }, message: 'must match "then" schema' };
    if (vErrors === null) {
      vErrors = [err12];
    } else {
      vErrors.push(err12);
    }
    errors2++;
    validate33.errors = vErrors;
    return false;
  }
  var valid0 = _errs1 === errors2;
  if (valid0) {
    const _errs19 = errors2;
    const _errs20 = errors2;
    let valid7 = true;
    const _errs21 = errors2;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing3;
      if (data.procedure === void 0 && (missing3 = "procedure")) {
        const err13 = {};
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors2++;
      }
    }
    var _valid3 = _errs21 === errors2;
    errors2 = _errs20;
    if (vErrors !== null) {
      if (_errs20) {
        vErrors.length = _errs20;
      } else {
        vErrors = null;
      }
    }
    if (_valid3) {
      const _errs22 = errors2;
      if (data && typeof data == "object" && !Array.isArray(data)) {
        if (data.skill !== void 0) {
          if (data.skill !== null) {
            validate33.errors = [{ instancePath: instancePath + "/skill", schemaPath: "#/allOf/1/then/properties/skill/type", keyword: "type", params: { type: "null" }, message: "must be null" }];
            return false;
          }
        }
      }
      var _valid3 = _errs22 === errors2;
      valid7 = _valid3;
      if (valid7) {
        var props2 = {};
        props2.skill = true;
        props2.procedure = true;
      }
    }
    if (!valid7) {
      const err14 = { instancePath, schemaPath: "#/allOf/1/if", keyword: "if", params: { failingKeyword: "then" }, message: 'must match "then" schema' };
      if (vErrors === null) {
        vErrors = [err14];
      } else {
        vErrors.push(err14);
      }
      errors2++;
      validate33.errors = vErrors;
      return false;
    }
    var valid0 = _errs19 === errors2;
    if (valid0) {
      if (props1 !== true && props2 !== void 0) {
        if (props2 === true) {
          props1 = true;
        } else {
          props1 = props1 || {};
          Object.assign(props1, props2);
        }
      }
    }
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing4;
      if (data.requestId === void 0 && (missing4 = "requestId") || data.prompt === void 0 && (missing4 = "prompt") || data.skill === void 0 && (missing4 = "skill") || data.window === void 0 && (missing4 = "window") || data.windowRequest === void 0 && (missing4 = "windowRequest")) {
        validate33.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing4 }, message: "must have required property '" + missing4 + "'" }];
        return false;
      } else {
        const _errs25 = errors2;
        for (const key0 in data) {
          if (!func1.call(schema38.properties, key0)) {
            validate33.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs25 === errors2) {
          if (data.requestId !== void 0) {
            let data6 = data.requestId;
            const _errs26 = errors2;
            if (errors2 === _errs26) {
              if (typeof data6 === "string") {
                if (!pattern4.test(data6)) {
                  validate33.errors = [{ instancePath: instancePath + "/requestId", schemaPath: "#/properties/requestId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' }];
                  return false;
                }
              } else {
                validate33.errors = [{ instancePath: instancePath + "/requestId", schemaPath: "#/properties/requestId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                return false;
              }
            }
            var valid9 = _errs26 === errors2;
          } else {
            var valid9 = true;
          }
          if (valid9) {
            if (data.prompt !== void 0) {
              let data7 = data.prompt;
              const _errs28 = errors2;
              if (errors2 === _errs28) {
                if (typeof data7 === "string") {
                  if (func2(data7) > 1e5) {
                    validate33.errors = [{ instancePath: instancePath + "/prompt", schemaPath: "#/properties/prompt/maxLength", keyword: "maxLength", params: { limit: 1e5 }, message: "must NOT have more than 100000 characters" }];
                    return false;
                  } else {
                    if (func2(data7) < 1) {
                      validate33.errors = [{ instancePath: instancePath + "/prompt", schemaPath: "#/properties/prompt/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                      return false;
                    } else {
                      if (!pattern5.test(data7)) {
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
              var valid9 = _errs28 === errors2;
            } else {
              var valid9 = true;
            }
            if (valid9) {
              if (data.skill !== void 0) {
                let data8 = data.skill;
                const _errs30 = errors2;
                const _errs31 = errors2;
                let valid10 = false;
                const _errs32 = errors2;
                if (!validate26(data8, { instancePath: instancePath + "/skill", parentData: data, parentDataProperty: "skill", rootData, dynamicAnchors })) {
                  vErrors = vErrors === null ? validate26.errors : vErrors.concat(validate26.errors);
                  errors2 = vErrors.length;
                }
                var _valid4 = _errs32 === errors2;
                valid10 = valid10 || _valid4;
                const _errs33 = errors2;
                if (data8 !== null) {
                  const err15 = { instancePath: instancePath + "/skill", schemaPath: "#/properties/skill/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                  if (vErrors === null) {
                    vErrors = [err15];
                  } else {
                    vErrors.push(err15);
                  }
                  errors2++;
                }
                var _valid4 = _errs33 === errors2;
                valid10 = valid10 || _valid4;
                if (!valid10) {
                  const err16 = { instancePath: instancePath + "/skill", schemaPath: "#/properties/skill/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                  if (vErrors === null) {
                    vErrors = [err16];
                  } else {
                    vErrors.push(err16);
                  }
                  errors2++;
                  validate33.errors = vErrors;
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
                var valid9 = _errs30 === errors2;
              } else {
                var valid9 = true;
              }
              if (valid9) {
                if (data.window !== void 0) {
                  let data9 = data.window;
                  const _errs35 = errors2;
                  const _errs36 = errors2;
                  let valid11 = false;
                  const _errs37 = errors2;
                  const _errs39 = errors2;
                  let valid13 = false;
                  let passing0 = null;
                  const _errs40 = errors2;
                  if (errors2 === _errs40) {
                    if (data9 && typeof data9 == "object" && !Array.isArray(data9)) {
                      let missing5;
                      if (data9.basis === void 0 && (missing5 = "basis") || data9.startInclusive === void 0 && (missing5 = "startInclusive") || data9.endExclusive === void 0 && (missing5 = "endExclusive") || data9.timezone === void 0 && (missing5 = "timezone") || data9.weekStartsOn === void 0 && (missing5 = "weekStartsOn")) {
                        const err17 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/0/required", keyword: "required", params: { missingProperty: missing5 }, message: "must have required property '" + missing5 + "'" };
                        if (vErrors === null) {
                          vErrors = [err17];
                        } else {
                          vErrors.push(err17);
                        }
                        errors2++;
                      } else {
                        const _errs42 = errors2;
                        for (const key1 in data9) {
                          if (!(key1 === "basis" || key1 === "startInclusive" || key1 === "endExclusive" || key1 === "timezone" || key1 === "weekStartsOn")) {
                            const err18 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
                            if (vErrors === null) {
                              vErrors = [err18];
                            } else {
                              vErrors.push(err18);
                            }
                            errors2++;
                            break;
                          }
                        }
                        if (_errs42 === errors2) {
                          if (data9.basis !== void 0) {
                            let data10 = data9.basis;
                            const _errs43 = errors2;
                            if (typeof data10 !== "string") {
                              const err19 = { instancePath: instancePath + "/window/basis", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/0/properties/basis/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                              if (vErrors === null) {
                                vErrors = [err19];
                              } else {
                                vErrors.push(err19);
                              }
                              errors2++;
                            }
                            if (!(data10 === "calendar-week" || data10 === "calendar-month" || data10 === "calendar-year" || data10 === "relative-duration" || data10 === "explicit")) {
                              const err20 = { instancePath: instancePath + "/window/basis", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/0/properties/basis/enum", keyword: "enum", params: { allowedValues: schema42.oneOf[0].properties.basis.enum }, message: "must be equal to one of the allowed values" };
                              if (vErrors === null) {
                                vErrors = [err20];
                              } else {
                                vErrors.push(err20);
                              }
                              errors2++;
                            }
                            var valid14 = _errs43 === errors2;
                          } else {
                            var valid14 = true;
                          }
                          if (valid14) {
                            if (data9.startInclusive !== void 0) {
                              let data11 = data9.startInclusive;
                              const _errs45 = errors2;
                              if (errors2 === _errs45) {
                                if (errors2 === _errs45) {
                                  if (typeof data11 === "string") {
                                    if (!pattern6.test(data11)) {
                                      const err21 = { instancePath: instancePath + "/window/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/0/properties/startInclusive/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                                      if (vErrors === null) {
                                        vErrors = [err21];
                                      } else {
                                        vErrors.push(err21);
                                      }
                                      errors2++;
                                    } else {
                                      if (!formats0.validate(data11)) {
                                        const err22 = { instancePath: instancePath + "/window/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/0/properties/startInclusive/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                        if (vErrors === null) {
                                          vErrors = [err22];
                                        } else {
                                          vErrors.push(err22);
                                        }
                                        errors2++;
                                      }
                                    }
                                  } else {
                                    const err23 = { instancePath: instancePath + "/window/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/0/properties/startInclusive/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                    if (vErrors === null) {
                                      vErrors = [err23];
                                    } else {
                                      vErrors.push(err23);
                                    }
                                    errors2++;
                                  }
                                }
                              }
                              var valid14 = _errs45 === errors2;
                            } else {
                              var valid14 = true;
                            }
                            if (valid14) {
                              if (data9.endExclusive !== void 0) {
                                let data12 = data9.endExclusive;
                                const _errs47 = errors2;
                                if (errors2 === _errs47) {
                                  if (errors2 === _errs47) {
                                    if (typeof data12 === "string") {
                                      if (!pattern6.test(data12)) {
                                        const err24 = { instancePath: instancePath + "/window/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/0/properties/endExclusive/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                                        if (vErrors === null) {
                                          vErrors = [err24];
                                        } else {
                                          vErrors.push(err24);
                                        }
                                        errors2++;
                                      } else {
                                        if (!formats0.validate(data12)) {
                                          const err25 = { instancePath: instancePath + "/window/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/0/properties/endExclusive/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                          if (vErrors === null) {
                                            vErrors = [err25];
                                          } else {
                                            vErrors.push(err25);
                                          }
                                          errors2++;
                                        }
                                      }
                                    } else {
                                      const err26 = { instancePath: instancePath + "/window/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/0/properties/endExclusive/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                      if (vErrors === null) {
                                        vErrors = [err26];
                                      } else {
                                        vErrors.push(err26);
                                      }
                                      errors2++;
                                    }
                                  }
                                }
                                var valid14 = _errs47 === errors2;
                              } else {
                                var valid14 = true;
                              }
                              if (valid14) {
                                if (data9.timezone !== void 0) {
                                  let data13 = data9.timezone;
                                  const _errs49 = errors2;
                                  if (errors2 === _errs49) {
                                    if (typeof data13 === "string") {
                                      if (func2(data13) > 100) {
                                        const err27 = { instancePath: instancePath + "/window/timezone", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/0/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                        if (vErrors === null) {
                                          vErrors = [err27];
                                        } else {
                                          vErrors.push(err27);
                                        }
                                        errors2++;
                                      } else {
                                        if (func2(data13) < 1) {
                                          const err28 = { instancePath: instancePath + "/window/timezone", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/0/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                          if (vErrors === null) {
                                            vErrors = [err28];
                                          } else {
                                            vErrors.push(err28);
                                          }
                                          errors2++;
                                        }
                                      }
                                    } else {
                                      const err29 = { instancePath: instancePath + "/window/timezone", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/0/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                      if (vErrors === null) {
                                        vErrors = [err29];
                                      } else {
                                        vErrors.push(err29);
                                      }
                                      errors2++;
                                    }
                                  }
                                  var valid14 = _errs49 === errors2;
                                } else {
                                  var valid14 = true;
                                }
                                if (valid14) {
                                  if (data9.weekStartsOn !== void 0) {
                                    let data14 = data9.weekStartsOn;
                                    const _errs51 = errors2;
                                    const _errs52 = errors2;
                                    let valid15 = false;
                                    const _errs53 = errors2;
                                    if (typeof data14 !== "string") {
                                      const err30 = { instancePath: instancePath + "/window/weekStartsOn", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/0/properties/weekStartsOn/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                      if (vErrors === null) {
                                        vErrors = [err30];
                                      } else {
                                        vErrors.push(err30);
                                      }
                                      errors2++;
                                    }
                                    if (!(data14 === "monday" || data14 === "sunday")) {
                                      const err31 = { instancePath: instancePath + "/window/weekStartsOn", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/0/properties/weekStartsOn/anyOf/0/enum", keyword: "enum", params: { allowedValues: schema42.oneOf[0].properties.weekStartsOn.anyOf[0].enum }, message: "must be equal to one of the allowed values" };
                                      if (vErrors === null) {
                                        vErrors = [err31];
                                      } else {
                                        vErrors.push(err31);
                                      }
                                      errors2++;
                                    }
                                    var _valid7 = _errs53 === errors2;
                                    valid15 = valid15 || _valid7;
                                    const _errs55 = errors2;
                                    if (data14 !== null) {
                                      const err32 = { instancePath: instancePath + "/window/weekStartsOn", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/0/properties/weekStartsOn/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                      if (vErrors === null) {
                                        vErrors = [err32];
                                      } else {
                                        vErrors.push(err32);
                                      }
                                      errors2++;
                                    }
                                    var _valid7 = _errs55 === errors2;
                                    valid15 = valid15 || _valid7;
                                    if (!valid15) {
                                      const err33 = { instancePath: instancePath + "/window/weekStartsOn", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/0/properties/weekStartsOn/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                      if (vErrors === null) {
                                        vErrors = [err33];
                                      } else {
                                        vErrors.push(err33);
                                      }
                                      errors2++;
                                    } else {
                                      errors2 = _errs52;
                                      if (vErrors !== null) {
                                        if (_errs52) {
                                          vErrors.length = _errs52;
                                        } else {
                                          vErrors = null;
                                        }
                                      }
                                    }
                                    var valid14 = _errs51 === errors2;
                                  } else {
                                    var valid14 = true;
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    } else {
                      const err34 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                      if (vErrors === null) {
                        vErrors = [err34];
                      } else {
                        vErrors.push(err34);
                      }
                      errors2++;
                    }
                  }
                  var _valid6 = _errs40 === errors2;
                  if (_valid6) {
                    valid13 = true;
                    passing0 = 0;
                    var props4 = true;
                  }
                  const _errs57 = errors2;
                  if (errors2 === _errs57) {
                    if (data9 && typeof data9 == "object" && !Array.isArray(data9)) {
                      let missing6;
                      if (data9.basis === void 0 && (missing6 = "basis") || data9.year === void 0 && (missing6 = "year") || data9.calendarId === void 0 && (missing6 = "calendarId") || data9.stage === void 0 && (missing6 = "stage") || data9.revisionId === void 0 && (missing6 = "revisionId") || data9.startInclusive === void 0 && (missing6 = "startInclusive") || data9.endExclusive === void 0 && (missing6 = "endExclusive") || data9.timezone === void 0 && (missing6 = "timezone")) {
                        const err35 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/required", keyword: "required", params: { missingProperty: missing6 }, message: "must have required property '" + missing6 + "'" };
                        if (vErrors === null) {
                          vErrors = [err35];
                        } else {
                          vErrors.push(err35);
                        }
                        errors2++;
                      } else {
                        const _errs59 = errors2;
                        for (const key2 in data9) {
                          if (!(key2 === "basis" || key2 === "year" || key2 === "calendarId" || key2 === "stage" || key2 === "revisionId" || key2 === "startInclusive" || key2 === "endExclusive" || key2 === "timezone")) {
                            const err36 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
                            if (vErrors === null) {
                              vErrors = [err36];
                            } else {
                              vErrors.push(err36);
                            }
                            errors2++;
                            break;
                          }
                        }
                        if (_errs59 === errors2) {
                          if (data9.basis !== void 0) {
                            const _errs60 = errors2;
                            if ("fiscal-year" !== data9.basis) {
                              const err37 = { instancePath: instancePath + "/window/basis", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/basis/const", keyword: "const", params: { allowedValue: "fiscal-year" }, message: "must be equal to constant" };
                              if (vErrors === null) {
                                vErrors = [err37];
                              } else {
                                vErrors.push(err37);
                              }
                              errors2++;
                            }
                            var valid16 = _errs60 === errors2;
                          } else {
                            var valid16 = true;
                          }
                          if (valid16) {
                            if (data9.year !== void 0) {
                              let data16 = data9.year;
                              const _errs61 = errors2;
                              if (!(typeof data16 == "number" && (!(data16 % 1) && !isNaN(data16)) && isFinite(data16))) {
                                const err38 = { instancePath: instancePath + "/window/year", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/year/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                if (vErrors === null) {
                                  vErrors = [err38];
                                } else {
                                  vErrors.push(err38);
                                }
                                errors2++;
                              }
                              if (errors2 === _errs61) {
                                if (typeof data16 == "number" && isFinite(data16)) {
                                  if (data16 > 3e3 || isNaN(data16)) {
                                    const err39 = { instancePath: instancePath + "/window/year", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/year/maximum", keyword: "maximum", params: { comparison: "<=", limit: 3e3 }, message: "must be <= 3000" };
                                    if (vErrors === null) {
                                      vErrors = [err39];
                                    } else {
                                      vErrors.push(err39);
                                    }
                                    errors2++;
                                  } else {
                                    if (data16 < 1900 || isNaN(data16)) {
                                      const err40 = { instancePath: instancePath + "/window/year", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/year/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1900 }, message: "must be >= 1900" };
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
                              var valid16 = _errs61 === errors2;
                            } else {
                              var valid16 = true;
                            }
                            if (valid16) {
                              if (data9.calendarId !== void 0) {
                                let data17 = data9.calendarId;
                                const _errs63 = errors2;
                                if (errors2 === _errs63) {
                                  if (typeof data17 === "string") {
                                    if (func2(data17) > 128) {
                                      const err41 = { instancePath: instancePath + "/window/calendarId", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/calendarId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                                      if (vErrors === null) {
                                        vErrors = [err41];
                                      } else {
                                        vErrors.push(err41);
                                      }
                                      errors2++;
                                    } else {
                                      if (func2(data17) < 1) {
                                        const err42 = { instancePath: instancePath + "/window/calendarId", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/calendarId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                        if (vErrors === null) {
                                          vErrors = [err42];
                                        } else {
                                          vErrors.push(err42);
                                        }
                                        errors2++;
                                      } else {
                                        if (!pattern9.test(data17)) {
                                          const err43 = { instancePath: instancePath + "/window/calendarId", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/calendarId/pattern", keyword: "pattern", params: { pattern: "^[a-z][a-z0-9_.-]*$" }, message: 'must match pattern "^[a-z][a-z0-9_.-]*$"' };
                                          if (vErrors === null) {
                                            vErrors = [err43];
                                          } else {
                                            vErrors.push(err43);
                                          }
                                          errors2++;
                                        }
                                      }
                                    }
                                  } else {
                                    const err44 = { instancePath: instancePath + "/window/calendarId", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/calendarId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                    if (vErrors === null) {
                                      vErrors = [err44];
                                    } else {
                                      vErrors.push(err44);
                                    }
                                    errors2++;
                                  }
                                }
                                var valid16 = _errs63 === errors2;
                              } else {
                                var valid16 = true;
                              }
                              if (valid16) {
                                if (data9.stage !== void 0) {
                                  let data18 = data9.stage;
                                  const _errs65 = errors2;
                                  if (typeof data18 !== "string") {
                                    const err45 = { instancePath: instancePath + "/window/stage", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/stage/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                    if (vErrors === null) {
                                      vErrors = [err45];
                                    } else {
                                      vErrors.push(err45);
                                    }
                                    errors2++;
                                  }
                                  if (!(data18 === "requested" || data18 === "authorized" || data18 === "appropriated" || data18 === "obligated" || data18 === "actual" || data18 === "outlay")) {
                                    const err46 = { instancePath: instancePath + "/window/stage", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/stage/enum", keyword: "enum", params: { allowedValues: schema42.oneOf[1].properties.stage.enum }, message: "must be equal to one of the allowed values" };
                                    if (vErrors === null) {
                                      vErrors = [err46];
                                    } else {
                                      vErrors.push(err46);
                                    }
                                    errors2++;
                                  }
                                  var valid16 = _errs65 === errors2;
                                } else {
                                  var valid16 = true;
                                }
                                if (valid16) {
                                  if (data9.revisionId !== void 0) {
                                    let data19 = data9.revisionId;
                                    const _errs67 = errors2;
                                    if (errors2 === _errs67) {
                                      if (typeof data19 === "string") {
                                        if (func2(data19) > 256) {
                                          const err47 = { instancePath: instancePath + "/window/revisionId", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/revisionId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" };
                                          if (vErrors === null) {
                                            vErrors = [err47];
                                          } else {
                                            vErrors.push(err47);
                                          }
                                          errors2++;
                                        } else {
                                          if (func2(data19) < 1) {
                                            const err48 = { instancePath: instancePath + "/window/revisionId", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/revisionId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                            if (vErrors === null) {
                                              vErrors = [err48];
                                            } else {
                                              vErrors.push(err48);
                                            }
                                            errors2++;
                                          }
                                        }
                                      } else {
                                        const err49 = { instancePath: instancePath + "/window/revisionId", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/revisionId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                        if (vErrors === null) {
                                          vErrors = [err49];
                                        } else {
                                          vErrors.push(err49);
                                        }
                                        errors2++;
                                      }
                                    }
                                    var valid16 = _errs67 === errors2;
                                  } else {
                                    var valid16 = true;
                                  }
                                  if (valid16) {
                                    if (data9.startInclusive !== void 0) {
                                      let data20 = data9.startInclusive;
                                      const _errs69 = errors2;
                                      if (errors2 === _errs69) {
                                        if (errors2 === _errs69) {
                                          if (typeof data20 === "string") {
                                            if (!pattern6.test(data20)) {
                                              const err50 = { instancePath: instancePath + "/window/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/startInclusive/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                                              if (vErrors === null) {
                                                vErrors = [err50];
                                              } else {
                                                vErrors.push(err50);
                                              }
                                              errors2++;
                                            } else {
                                              if (!formats0.validate(data20)) {
                                                const err51 = { instancePath: instancePath + "/window/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/startInclusive/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                                if (vErrors === null) {
                                                  vErrors = [err51];
                                                } else {
                                                  vErrors.push(err51);
                                                }
                                                errors2++;
                                              }
                                            }
                                          } else {
                                            const err52 = { instancePath: instancePath + "/window/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/startInclusive/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                            if (vErrors === null) {
                                              vErrors = [err52];
                                            } else {
                                              vErrors.push(err52);
                                            }
                                            errors2++;
                                          }
                                        }
                                      }
                                      var valid16 = _errs69 === errors2;
                                    } else {
                                      var valid16 = true;
                                    }
                                    if (valid16) {
                                      if (data9.endExclusive !== void 0) {
                                        let data21 = data9.endExclusive;
                                        const _errs71 = errors2;
                                        if (errors2 === _errs71) {
                                          if (errors2 === _errs71) {
                                            if (typeof data21 === "string") {
                                              if (!pattern6.test(data21)) {
                                                const err53 = { instancePath: instancePath + "/window/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/endExclusive/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                                                if (vErrors === null) {
                                                  vErrors = [err53];
                                                } else {
                                                  vErrors.push(err53);
                                                }
                                                errors2++;
                                              } else {
                                                if (!formats0.validate(data21)) {
                                                  const err54 = { instancePath: instancePath + "/window/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/endExclusive/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                                  if (vErrors === null) {
                                                    vErrors = [err54];
                                                  } else {
                                                    vErrors.push(err54);
                                                  }
                                                  errors2++;
                                                }
                                              }
                                            } else {
                                              const err55 = { instancePath: instancePath + "/window/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/endExclusive/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                              if (vErrors === null) {
                                                vErrors = [err55];
                                              } else {
                                                vErrors.push(err55);
                                              }
                                              errors2++;
                                            }
                                          }
                                        }
                                        var valid16 = _errs71 === errors2;
                                      } else {
                                        var valid16 = true;
                                      }
                                      if (valid16) {
                                        if (data9.timezone !== void 0) {
                                          let data22 = data9.timezone;
                                          const _errs73 = errors2;
                                          if (errors2 === _errs73) {
                                            if (typeof data22 === "string") {
                                              if (func2(data22) > 100) {
                                                const err56 = { instancePath: instancePath + "/window/timezone", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                                if (vErrors === null) {
                                                  vErrors = [err56];
                                                } else {
                                                  vErrors.push(err56);
                                                }
                                                errors2++;
                                              } else {
                                                if (func2(data22) < 1) {
                                                  const err57 = { instancePath: instancePath + "/window/timezone", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                                  if (vErrors === null) {
                                                    vErrors = [err57];
                                                  } else {
                                                    vErrors.push(err57);
                                                  }
                                                  errors2++;
                                                }
                                              }
                                            } else {
                                              const err58 = { instancePath: instancePath + "/window/timezone", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                              if (vErrors === null) {
                                                vErrors = [err58];
                                              } else {
                                                vErrors.push(err58);
                                              }
                                              errors2++;
                                            }
                                          }
                                          var valid16 = _errs73 === errors2;
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
                      const err59 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                      if (vErrors === null) {
                        vErrors = [err59];
                      } else {
                        vErrors.push(err59);
                      }
                      errors2++;
                    }
                  }
                  var _valid6 = _errs57 === errors2;
                  if (_valid6 && valid13) {
                    valid13 = false;
                    passing0 = [passing0, 1];
                  } else {
                    if (_valid6) {
                      valid13 = true;
                      passing0 = 1;
                      if (props4 !== true) {
                        props4 = true;
                      }
                    }
                    const _errs75 = errors2;
                    if (errors2 === _errs75) {
                      if (data9 && typeof data9 == "object" && !Array.isArray(data9)) {
                        let missing7;
                        if (data9.basis === void 0 && (missing7 = "basis")) {
                          const err60 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/2/required", keyword: "required", params: { missingProperty: missing7 }, message: "must have required property '" + missing7 + "'" };
                          if (vErrors === null) {
                            vErrors = [err60];
                          } else {
                            vErrors.push(err60);
                          }
                          errors2++;
                        } else {
                          const _errs77 = errors2;
                          for (const key3 in data9) {
                            if (!(key3 === "basis")) {
                              const err61 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/2/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" };
                              if (vErrors === null) {
                                vErrors = [err61];
                              } else {
                                vErrors.push(err61);
                              }
                              errors2++;
                              break;
                            }
                          }
                          if (_errs77 === errors2) {
                            if (data9.basis !== void 0) {
                              if ("unbounded" !== data9.basis) {
                                const err62 = { instancePath: instancePath + "/window/basis", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/2/properties/basis/const", keyword: "const", params: { allowedValue: "unbounded" }, message: "must be equal to constant" };
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
                      } else {
                        const err63 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf/2/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                        if (vErrors === null) {
                          vErrors = [err63];
                        } else {
                          vErrors.push(err63);
                        }
                        errors2++;
                      }
                    }
                    var _valid6 = _errs75 === errors2;
                    if (_valid6 && valid13) {
                      valid13 = false;
                      passing0 = [passing0, 2];
                    } else {
                      if (_valid6) {
                        valid13 = true;
                        passing0 = 2;
                        if (props4 !== true) {
                          props4 = true;
                        }
                      }
                    }
                  }
                  if (!valid13) {
                    const err64 = { instancePath: instancePath + "/window", schemaPath: "#/$defs/Canonical_Canonical_NormalizedWindow_e50ec0ed_babbab24/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
                    if (vErrors === null) {
                      vErrors = [err64];
                    } else {
                      vErrors.push(err64);
                    }
                    errors2++;
                  } else {
                    errors2 = _errs39;
                    if (vErrors !== null) {
                      if (_errs39) {
                        vErrors.length = _errs39;
                      } else {
                        vErrors = null;
                      }
                    }
                  }
                  var _valid5 = _errs37 === errors2;
                  valid11 = valid11 || _valid5;
                  const _errs79 = errors2;
                  if (data9 !== null) {
                    const err65 = { instancePath: instancePath + "/window", schemaPath: "#/properties/window/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                    if (vErrors === null) {
                      vErrors = [err65];
                    } else {
                      vErrors.push(err65);
                    }
                    errors2++;
                  }
                  var _valid5 = _errs79 === errors2;
                  valid11 = valid11 || _valid5;
                  if (!valid11) {
                    const err66 = { instancePath: instancePath + "/window", schemaPath: "#/properties/window/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                    if (vErrors === null) {
                      vErrors = [err66];
                    } else {
                      vErrors.push(err66);
                    }
                    errors2++;
                    validate33.errors = vErrors;
                    return false;
                  } else {
                    errors2 = _errs36;
                    if (vErrors !== null) {
                      if (_errs36) {
                        vErrors.length = _errs36;
                      } else {
                        vErrors = null;
                      }
                    }
                  }
                  var valid9 = _errs35 === errors2;
                } else {
                  var valid9 = true;
                }
                if (valid9) {
                  if (data.windowRequest !== void 0) {
                    let data24 = data.windowRequest;
                    const _errs81 = errors2;
                    const _errs82 = errors2;
                    let valid18 = false;
                    const _errs83 = errors2;
                    const _errs85 = errors2;
                    let valid20 = false;
                    let passing1 = null;
                    const _errs86 = errors2;
                    if (errors2 === _errs86) {
                      if (data24 && typeof data24 == "object" && !Array.isArray(data24)) {
                        let missing8;
                        if (data24.basis === void 0 && (missing8 = "basis") || data24.offset === void 0 && (missing8 = "offset") || data24.timezone === void 0 && (missing8 = "timezone") || data24.weekStartsOn === void 0 && (missing8 = "weekStartsOn")) {
                          const err67 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/0/required", keyword: "required", params: { missingProperty: missing8 }, message: "must have required property '" + missing8 + "'" };
                          if (vErrors === null) {
                            vErrors = [err67];
                          } else {
                            vErrors.push(err67);
                          }
                          errors2++;
                        } else {
                          const _errs88 = errors2;
                          for (const key4 in data24) {
                            if (!(key4 === "basis" || key4 === "offset" || key4 === "timezone" || key4 === "weekStartsOn")) {
                              const err68 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key4 }, message: "must NOT have additional properties" };
                              if (vErrors === null) {
                                vErrors = [err68];
                              } else {
                                vErrors.push(err68);
                              }
                              errors2++;
                              break;
                            }
                          }
                          if (_errs88 === errors2) {
                            if (data24.basis !== void 0) {
                              const _errs89 = errors2;
                              if ("calendar-week" !== data24.basis) {
                                const err69 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/0/properties/basis/const", keyword: "const", params: { allowedValue: "calendar-week" }, message: "must be equal to constant" };
                                if (vErrors === null) {
                                  vErrors = [err69];
                                } else {
                                  vErrors.push(err69);
                                }
                                errors2++;
                              }
                              var valid21 = _errs89 === errors2;
                            } else {
                              var valid21 = true;
                            }
                            if (valid21) {
                              if (data24.offset !== void 0) {
                                let data26 = data24.offset;
                                const _errs90 = errors2;
                                if (!(typeof data26 == "number" && (!(data26 % 1) && !isNaN(data26)) && isFinite(data26))) {
                                  const err70 = { instancePath: instancePath + "/windowRequest/offset", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/0/properties/offset/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                  if (vErrors === null) {
                                    vErrors = [err70];
                                  } else {
                                    vErrors.push(err70);
                                  }
                                  errors2++;
                                }
                                if (!(data26 === -1 || data26 === 0)) {
                                  const err71 = { instancePath: instancePath + "/windowRequest/offset", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/0/properties/offset/enum", keyword: "enum", params: { allowedValues: schema34.oneOf[0].properties.offset.enum }, message: "must be equal to one of the allowed values" };
                                  if (vErrors === null) {
                                    vErrors = [err71];
                                  } else {
                                    vErrors.push(err71);
                                  }
                                  errors2++;
                                }
                                var valid21 = _errs90 === errors2;
                              } else {
                                var valid21 = true;
                              }
                              if (valid21) {
                                if (data24.timezone !== void 0) {
                                  let data27 = data24.timezone;
                                  const _errs92 = errors2;
                                  if (errors2 === _errs92) {
                                    if (typeof data27 === "string") {
                                      if (func2(data27) > 100) {
                                        const err72 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/0/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                        if (vErrors === null) {
                                          vErrors = [err72];
                                        } else {
                                          vErrors.push(err72);
                                        }
                                        errors2++;
                                      } else {
                                        if (func2(data27) < 1) {
                                          const err73 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/0/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                          if (vErrors === null) {
                                            vErrors = [err73];
                                          } else {
                                            vErrors.push(err73);
                                          }
                                          errors2++;
                                        }
                                      }
                                    } else {
                                      const err74 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/0/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                      if (vErrors === null) {
                                        vErrors = [err74];
                                      } else {
                                        vErrors.push(err74);
                                      }
                                      errors2++;
                                    }
                                  }
                                  var valid21 = _errs92 === errors2;
                                } else {
                                  var valid21 = true;
                                }
                                if (valid21) {
                                  if (data24.weekStartsOn !== void 0) {
                                    let data28 = data24.weekStartsOn;
                                    const _errs94 = errors2;
                                    if (typeof data28 !== "string") {
                                      const err75 = { instancePath: instancePath + "/windowRequest/weekStartsOn", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/0/properties/weekStartsOn/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                      if (vErrors === null) {
                                        vErrors = [err75];
                                      } else {
                                        vErrors.push(err75);
                                      }
                                      errors2++;
                                    }
                                    if (!(data28 === "monday" || data28 === "sunday")) {
                                      const err76 = { instancePath: instancePath + "/windowRequest/weekStartsOn", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/0/properties/weekStartsOn/enum", keyword: "enum", params: { allowedValues: schema34.oneOf[0].properties.weekStartsOn.enum }, message: "must be equal to one of the allowed values" };
                                      if (vErrors === null) {
                                        vErrors = [err76];
                                      } else {
                                        vErrors.push(err76);
                                      }
                                      errors2++;
                                    }
                                    var valid21 = _errs94 === errors2;
                                  } else {
                                    var valid21 = true;
                                  }
                                }
                              }
                            }
                          }
                        }
                      } else {
                        const err77 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                        if (vErrors === null) {
                          vErrors = [err77];
                        } else {
                          vErrors.push(err77);
                        }
                        errors2++;
                      }
                    }
                    var _valid9 = _errs86 === errors2;
                    if (_valid9) {
                      valid20 = true;
                      passing1 = 0;
                      var props5 = true;
                    }
                    const _errs96 = errors2;
                    if (errors2 === _errs96) {
                      if (data24 && typeof data24 == "object" && !Array.isArray(data24)) {
                        let missing9;
                        if (data24.basis === void 0 && (missing9 = "basis") || data24.offset === void 0 && (missing9 = "offset") || data24.timezone === void 0 && (missing9 = "timezone")) {
                          const err78 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/1/required", keyword: "required", params: { missingProperty: missing9 }, message: "must have required property '" + missing9 + "'" };
                          if (vErrors === null) {
                            vErrors = [err78];
                          } else {
                            vErrors.push(err78);
                          }
                          errors2++;
                        } else {
                          const _errs98 = errors2;
                          for (const key5 in data24) {
                            if (!(key5 === "basis" || key5 === "offset" || key5 === "timezone")) {
                              const err79 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key5 }, message: "must NOT have additional properties" };
                              if (vErrors === null) {
                                vErrors = [err79];
                              } else {
                                vErrors.push(err79);
                              }
                              errors2++;
                              break;
                            }
                          }
                          if (_errs98 === errors2) {
                            if (data24.basis !== void 0) {
                              const _errs99 = errors2;
                              if ("calendar-month" !== data24.basis) {
                                const err80 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/1/properties/basis/const", keyword: "const", params: { allowedValue: "calendar-month" }, message: "must be equal to constant" };
                                if (vErrors === null) {
                                  vErrors = [err80];
                                } else {
                                  vErrors.push(err80);
                                }
                                errors2++;
                              }
                              var valid22 = _errs99 === errors2;
                            } else {
                              var valid22 = true;
                            }
                            if (valid22) {
                              if (data24.offset !== void 0) {
                                let data30 = data24.offset;
                                const _errs100 = errors2;
                                if (!(typeof data30 == "number" && (!(data30 % 1) && !isNaN(data30)) && isFinite(data30))) {
                                  const err81 = { instancePath: instancePath + "/windowRequest/offset", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/1/properties/offset/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                  if (vErrors === null) {
                                    vErrors = [err81];
                                  } else {
                                    vErrors.push(err81);
                                  }
                                  errors2++;
                                }
                                if (!(data30 === -1 || data30 === 0)) {
                                  const err82 = { instancePath: instancePath + "/windowRequest/offset", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/1/properties/offset/enum", keyword: "enum", params: { allowedValues: schema34.oneOf[1].properties.offset.enum }, message: "must be equal to one of the allowed values" };
                                  if (vErrors === null) {
                                    vErrors = [err82];
                                  } else {
                                    vErrors.push(err82);
                                  }
                                  errors2++;
                                }
                                var valid22 = _errs100 === errors2;
                              } else {
                                var valid22 = true;
                              }
                              if (valid22) {
                                if (data24.timezone !== void 0) {
                                  let data31 = data24.timezone;
                                  const _errs102 = errors2;
                                  if (errors2 === _errs102) {
                                    if (typeof data31 === "string") {
                                      if (func2(data31) > 100) {
                                        const err83 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/1/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                        if (vErrors === null) {
                                          vErrors = [err83];
                                        } else {
                                          vErrors.push(err83);
                                        }
                                        errors2++;
                                      } else {
                                        if (func2(data31) < 1) {
                                          const err84 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/1/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                          if (vErrors === null) {
                                            vErrors = [err84];
                                          } else {
                                            vErrors.push(err84);
                                          }
                                          errors2++;
                                        }
                                      }
                                    } else {
                                      const err85 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/1/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                      if (vErrors === null) {
                                        vErrors = [err85];
                                      } else {
                                        vErrors.push(err85);
                                      }
                                      errors2++;
                                    }
                                  }
                                  var valid22 = _errs102 === errors2;
                                } else {
                                  var valid22 = true;
                                }
                              }
                            }
                          }
                        }
                      } else {
                        const err86 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                        if (vErrors === null) {
                          vErrors = [err86];
                        } else {
                          vErrors.push(err86);
                        }
                        errors2++;
                      }
                    }
                    var _valid9 = _errs96 === errors2;
                    if (_valid9 && valid20) {
                      valid20 = false;
                      passing1 = [passing1, 1];
                    } else {
                      if (_valid9) {
                        valid20 = true;
                        passing1 = 1;
                        if (props5 !== true) {
                          props5 = true;
                        }
                      }
                      const _errs104 = errors2;
                      if (errors2 === _errs104) {
                        if (data24 && typeof data24 == "object" && !Array.isArray(data24)) {
                          let missing10;
                          if (data24.basis === void 0 && (missing10 = "basis") || data24.offset === void 0 && (missing10 = "offset") || data24.timezone === void 0 && (missing10 = "timezone")) {
                            const err87 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/2/required", keyword: "required", params: { missingProperty: missing10 }, message: "must have required property '" + missing10 + "'" };
                            if (vErrors === null) {
                              vErrors = [err87];
                            } else {
                              vErrors.push(err87);
                            }
                            errors2++;
                          } else {
                            const _errs106 = errors2;
                            for (const key6 in data24) {
                              if (!(key6 === "basis" || key6 === "offset" || key6 === "timezone")) {
                                const err88 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/2/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key6 }, message: "must NOT have additional properties" };
                                if (vErrors === null) {
                                  vErrors = [err88];
                                } else {
                                  vErrors.push(err88);
                                }
                                errors2++;
                                break;
                              }
                            }
                            if (_errs106 === errors2) {
                              if (data24.basis !== void 0) {
                                const _errs107 = errors2;
                                if ("calendar-year" !== data24.basis) {
                                  const err89 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/2/properties/basis/const", keyword: "const", params: { allowedValue: "calendar-year" }, message: "must be equal to constant" };
                                  if (vErrors === null) {
                                    vErrors = [err89];
                                  } else {
                                    vErrors.push(err89);
                                  }
                                  errors2++;
                                }
                                var valid23 = _errs107 === errors2;
                              } else {
                                var valid23 = true;
                              }
                              if (valid23) {
                                if (data24.offset !== void 0) {
                                  let data33 = data24.offset;
                                  const _errs108 = errors2;
                                  if (!(typeof data33 == "number" && (!(data33 % 1) && !isNaN(data33)) && isFinite(data33))) {
                                    const err90 = { instancePath: instancePath + "/windowRequest/offset", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/2/properties/offset/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                    if (vErrors === null) {
                                      vErrors = [err90];
                                    } else {
                                      vErrors.push(err90);
                                    }
                                    errors2++;
                                  }
                                  if (!(data33 === -1 || data33 === 0)) {
                                    const err91 = { instancePath: instancePath + "/windowRequest/offset", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/2/properties/offset/enum", keyword: "enum", params: { allowedValues: schema34.oneOf[2].properties.offset.enum }, message: "must be equal to one of the allowed values" };
                                    if (vErrors === null) {
                                      vErrors = [err91];
                                    } else {
                                      vErrors.push(err91);
                                    }
                                    errors2++;
                                  }
                                  var valid23 = _errs108 === errors2;
                                } else {
                                  var valid23 = true;
                                }
                                if (valid23) {
                                  if (data24.timezone !== void 0) {
                                    let data34 = data24.timezone;
                                    const _errs110 = errors2;
                                    if (errors2 === _errs110) {
                                      if (typeof data34 === "string") {
                                        if (func2(data34) > 100) {
                                          const err92 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/2/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                          if (vErrors === null) {
                                            vErrors = [err92];
                                          } else {
                                            vErrors.push(err92);
                                          }
                                          errors2++;
                                        } else {
                                          if (func2(data34) < 1) {
                                            const err93 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/2/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                            if (vErrors === null) {
                                              vErrors = [err93];
                                            } else {
                                              vErrors.push(err93);
                                            }
                                            errors2++;
                                          }
                                        }
                                      } else {
                                        const err94 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/2/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                        if (vErrors === null) {
                                          vErrors = [err94];
                                        } else {
                                          vErrors.push(err94);
                                        }
                                        errors2++;
                                      }
                                    }
                                    var valid23 = _errs110 === errors2;
                                  } else {
                                    var valid23 = true;
                                  }
                                }
                              }
                            }
                          }
                        } else {
                          const err95 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/2/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                          if (vErrors === null) {
                            vErrors = [err95];
                          } else {
                            vErrors.push(err95);
                          }
                          errors2++;
                        }
                      }
                      var _valid9 = _errs104 === errors2;
                      if (_valid9 && valid20) {
                        valid20 = false;
                        passing1 = [passing1, 2];
                      } else {
                        if (_valid9) {
                          valid20 = true;
                          passing1 = 2;
                          if (props5 !== true) {
                            props5 = true;
                          }
                        }
                        const _errs112 = errors2;
                        if (errors2 === _errs112) {
                          if (data24 && typeof data24 == "object" && !Array.isArray(data24)) {
                            let missing11;
                            if (data24.basis === void 0 && (missing11 = "basis") || data24.days === void 0 && (missing11 = "days") || data24.anchorAt === void 0 && (missing11 = "anchorAt") || data24.timezone === void 0 && (missing11 = "timezone")) {
                              const err96 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/3/required", keyword: "required", params: { missingProperty: missing11 }, message: "must have required property '" + missing11 + "'" };
                              if (vErrors === null) {
                                vErrors = [err96];
                              } else {
                                vErrors.push(err96);
                              }
                              errors2++;
                            } else {
                              const _errs114 = errors2;
                              for (const key7 in data24) {
                                if (!(key7 === "basis" || key7 === "days" || key7 === "anchorAt" || key7 === "timezone")) {
                                  const err97 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/3/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key7 }, message: "must NOT have additional properties" };
                                  if (vErrors === null) {
                                    vErrors = [err97];
                                  } else {
                                    vErrors.push(err97);
                                  }
                                  errors2++;
                                  break;
                                }
                              }
                              if (_errs114 === errors2) {
                                if (data24.basis !== void 0) {
                                  const _errs115 = errors2;
                                  if ("relative-duration" !== data24.basis) {
                                    const err98 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/3/properties/basis/const", keyword: "const", params: { allowedValue: "relative-duration" }, message: "must be equal to constant" };
                                    if (vErrors === null) {
                                      vErrors = [err98];
                                    } else {
                                      vErrors.push(err98);
                                    }
                                    errors2++;
                                  }
                                  var valid24 = _errs115 === errors2;
                                } else {
                                  var valid24 = true;
                                }
                                if (valid24) {
                                  if (data24.days !== void 0) {
                                    let data36 = data24.days;
                                    const _errs116 = errors2;
                                    if (!(typeof data36 == "number" && (!(data36 % 1) && !isNaN(data36)) && isFinite(data36))) {
                                      const err99 = { instancePath: instancePath + "/windowRequest/days", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/3/properties/days/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                      if (vErrors === null) {
                                        vErrors = [err99];
                                      } else {
                                        vErrors.push(err99);
                                      }
                                      errors2++;
                                    }
                                    if (errors2 === _errs116) {
                                      if (typeof data36 == "number" && isFinite(data36)) {
                                        if (data36 > 3660 || isNaN(data36)) {
                                          const err100 = { instancePath: instancePath + "/windowRequest/days", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/3/properties/days/maximum", keyword: "maximum", params: { comparison: "<=", limit: 3660 }, message: "must be <= 3660" };
                                          if (vErrors === null) {
                                            vErrors = [err100];
                                          } else {
                                            vErrors.push(err100);
                                          }
                                          errors2++;
                                        } else {
                                          if (data36 < 1 || isNaN(data36)) {
                                            const err101 = { instancePath: instancePath + "/windowRequest/days", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/3/properties/days/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                                            if (vErrors === null) {
                                              vErrors = [err101];
                                            } else {
                                              vErrors.push(err101);
                                            }
                                            errors2++;
                                          }
                                        }
                                      }
                                    }
                                    var valid24 = _errs116 === errors2;
                                  } else {
                                    var valid24 = true;
                                  }
                                  if (valid24) {
                                    if (data24.anchorAt !== void 0) {
                                      let data37 = data24.anchorAt;
                                      const _errs118 = errors2;
                                      if (errors2 === _errs118) {
                                        if (errors2 === _errs118) {
                                          if (typeof data37 === "string") {
                                            if (!pattern6.test(data37)) {
                                              const err102 = { instancePath: instancePath + "/windowRequest/anchorAt", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/3/properties/anchorAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                                              if (vErrors === null) {
                                                vErrors = [err102];
                                              } else {
                                                vErrors.push(err102);
                                              }
                                              errors2++;
                                            } else {
                                              if (!formats0.validate(data37)) {
                                                const err103 = { instancePath: instancePath + "/windowRequest/anchorAt", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/3/properties/anchorAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                                if (vErrors === null) {
                                                  vErrors = [err103];
                                                } else {
                                                  vErrors.push(err103);
                                                }
                                                errors2++;
                                              }
                                            }
                                          } else {
                                            const err104 = { instancePath: instancePath + "/windowRequest/anchorAt", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/3/properties/anchorAt/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                            if (vErrors === null) {
                                              vErrors = [err104];
                                            } else {
                                              vErrors.push(err104);
                                            }
                                            errors2++;
                                          }
                                        }
                                      }
                                      var valid24 = _errs118 === errors2;
                                    } else {
                                      var valid24 = true;
                                    }
                                    if (valid24) {
                                      if (data24.timezone !== void 0) {
                                        let data38 = data24.timezone;
                                        const _errs120 = errors2;
                                        if (errors2 === _errs120) {
                                          if (typeof data38 === "string") {
                                            if (func2(data38) > 100) {
                                              const err105 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/3/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                              if (vErrors === null) {
                                                vErrors = [err105];
                                              } else {
                                                vErrors.push(err105);
                                              }
                                              errors2++;
                                            } else {
                                              if (func2(data38) < 1) {
                                                const err106 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/3/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                                if (vErrors === null) {
                                                  vErrors = [err106];
                                                } else {
                                                  vErrors.push(err106);
                                                }
                                                errors2++;
                                              }
                                            }
                                          } else {
                                            const err107 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/3/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                            if (vErrors === null) {
                                              vErrors = [err107];
                                            } else {
                                              vErrors.push(err107);
                                            }
                                            errors2++;
                                          }
                                        }
                                        var valid24 = _errs120 === errors2;
                                      } else {
                                        var valid24 = true;
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          } else {
                            const err108 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/3/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                            if (vErrors === null) {
                              vErrors = [err108];
                            } else {
                              vErrors.push(err108);
                            }
                            errors2++;
                          }
                        }
                        var _valid9 = _errs112 === errors2;
                        if (_valid9 && valid20) {
                          valid20 = false;
                          passing1 = [passing1, 3];
                        } else {
                          if (_valid9) {
                            valid20 = true;
                            passing1 = 3;
                            if (props5 !== true) {
                              props5 = true;
                            }
                          }
                          const _errs122 = errors2;
                          if (errors2 === _errs122) {
                            if (data24 && typeof data24 == "object" && !Array.isArray(data24)) {
                              let missing12;
                              if (data24.basis === void 0 && (missing12 = "basis") || data24.startInclusive === void 0 && (missing12 = "startInclusive") || data24.endExclusive === void 0 && (missing12 = "endExclusive") || data24.timezone === void 0 && (missing12 = "timezone")) {
                                const err109 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/4/required", keyword: "required", params: { missingProperty: missing12 }, message: "must have required property '" + missing12 + "'" };
                                if (vErrors === null) {
                                  vErrors = [err109];
                                } else {
                                  vErrors.push(err109);
                                }
                                errors2++;
                              } else {
                                const _errs124 = errors2;
                                for (const key8 in data24) {
                                  if (!(key8 === "basis" || key8 === "startInclusive" || key8 === "endExclusive" || key8 === "timezone")) {
                                    const err110 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/4/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key8 }, message: "must NOT have additional properties" };
                                    if (vErrors === null) {
                                      vErrors = [err110];
                                    } else {
                                      vErrors.push(err110);
                                    }
                                    errors2++;
                                    break;
                                  }
                                }
                                if (_errs124 === errors2) {
                                  if (data24.basis !== void 0) {
                                    const _errs125 = errors2;
                                    if ("explicit" !== data24.basis) {
                                      const err111 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/4/properties/basis/const", keyword: "const", params: { allowedValue: "explicit" }, message: "must be equal to constant" };
                                      if (vErrors === null) {
                                        vErrors = [err111];
                                      } else {
                                        vErrors.push(err111);
                                      }
                                      errors2++;
                                    }
                                    var valid25 = _errs125 === errors2;
                                  } else {
                                    var valid25 = true;
                                  }
                                  if (valid25) {
                                    if (data24.startInclusive !== void 0) {
                                      let data40 = data24.startInclusive;
                                      const _errs126 = errors2;
                                      if (errors2 === _errs126) {
                                        if (errors2 === _errs126) {
                                          if (typeof data40 === "string") {
                                            if (!pattern6.test(data40)) {
                                              const err112 = { instancePath: instancePath + "/windowRequest/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/4/properties/startInclusive/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                                              if (vErrors === null) {
                                                vErrors = [err112];
                                              } else {
                                                vErrors.push(err112);
                                              }
                                              errors2++;
                                            } else {
                                              if (!formats0.validate(data40)) {
                                                const err113 = { instancePath: instancePath + "/windowRequest/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/4/properties/startInclusive/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                                if (vErrors === null) {
                                                  vErrors = [err113];
                                                } else {
                                                  vErrors.push(err113);
                                                }
                                                errors2++;
                                              }
                                            }
                                          } else {
                                            const err114 = { instancePath: instancePath + "/windowRequest/startInclusive", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/4/properties/startInclusive/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                            if (vErrors === null) {
                                              vErrors = [err114];
                                            } else {
                                              vErrors.push(err114);
                                            }
                                            errors2++;
                                          }
                                        }
                                      }
                                      var valid25 = _errs126 === errors2;
                                    } else {
                                      var valid25 = true;
                                    }
                                    if (valid25) {
                                      if (data24.endExclusive !== void 0) {
                                        let data41 = data24.endExclusive;
                                        const _errs128 = errors2;
                                        if (errors2 === _errs128) {
                                          if (errors2 === _errs128) {
                                            if (typeof data41 === "string") {
                                              if (!pattern6.test(data41)) {
                                                const err115 = { instancePath: instancePath + "/windowRequest/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/4/properties/endExclusive/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' };
                                                if (vErrors === null) {
                                                  vErrors = [err115];
                                                } else {
                                                  vErrors.push(err115);
                                                }
                                                errors2++;
                                              } else {
                                                if (!formats0.validate(data41)) {
                                                  const err116 = { instancePath: instancePath + "/windowRequest/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/4/properties/endExclusive/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                                  if (vErrors === null) {
                                                    vErrors = [err116];
                                                  } else {
                                                    vErrors.push(err116);
                                                  }
                                                  errors2++;
                                                }
                                              }
                                            } else {
                                              const err117 = { instancePath: instancePath + "/windowRequest/endExclusive", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/4/properties/endExclusive/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                              if (vErrors === null) {
                                                vErrors = [err117];
                                              } else {
                                                vErrors.push(err117);
                                              }
                                              errors2++;
                                            }
                                          }
                                        }
                                        var valid25 = _errs128 === errors2;
                                      } else {
                                        var valid25 = true;
                                      }
                                      if (valid25) {
                                        if (data24.timezone !== void 0) {
                                          let data42 = data24.timezone;
                                          const _errs130 = errors2;
                                          if (errors2 === _errs130) {
                                            if (typeof data42 === "string") {
                                              if (func2(data42) > 100) {
                                                const err118 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/4/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                                if (vErrors === null) {
                                                  vErrors = [err118];
                                                } else {
                                                  vErrors.push(err118);
                                                }
                                                errors2++;
                                              } else {
                                                if (func2(data42) < 1) {
                                                  const err119 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/4/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                                  if (vErrors === null) {
                                                    vErrors = [err119];
                                                  } else {
                                                    vErrors.push(err119);
                                                  }
                                                  errors2++;
                                                }
                                              }
                                            } else {
                                              const err120 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/4/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                              if (vErrors === null) {
                                                vErrors = [err120];
                                              } else {
                                                vErrors.push(err120);
                                              }
                                              errors2++;
                                            }
                                          }
                                          var valid25 = _errs130 === errors2;
                                        } else {
                                          var valid25 = true;
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            } else {
                              const err121 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/4/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                              if (vErrors === null) {
                                vErrors = [err121];
                              } else {
                                vErrors.push(err121);
                              }
                              errors2++;
                            }
                          }
                          var _valid9 = _errs122 === errors2;
                          if (_valid9 && valid20) {
                            valid20 = false;
                            passing1 = [passing1, 4];
                          } else {
                            if (_valid9) {
                              valid20 = true;
                              passing1 = 4;
                              if (props5 !== true) {
                                props5 = true;
                              }
                            }
                            const _errs132 = errors2;
                            if (errors2 === _errs132) {
                              if (data24 && typeof data24 == "object" && !Array.isArray(data24)) {
                                let missing13;
                                if (data24.basis === void 0 && (missing13 = "basis") || data24.year === void 0 && (missing13 = "year") || data24.calendarId === void 0 && (missing13 = "calendarId") || data24.stage === void 0 && (missing13 = "stage") || data24.revisionId === void 0 && (missing13 = "revisionId") || data24.timezone === void 0 && (missing13 = "timezone")) {
                                  const err122 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/required", keyword: "required", params: { missingProperty: missing13 }, message: "must have required property '" + missing13 + "'" };
                                  if (vErrors === null) {
                                    vErrors = [err122];
                                  } else {
                                    vErrors.push(err122);
                                  }
                                  errors2++;
                                } else {
                                  const _errs134 = errors2;
                                  for (const key9 in data24) {
                                    if (!(key9 === "basis" || key9 === "year" || key9 === "calendarId" || key9 === "stage" || key9 === "revisionId" || key9 === "timezone")) {
                                      const err123 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key9 }, message: "must NOT have additional properties" };
                                      if (vErrors === null) {
                                        vErrors = [err123];
                                      } else {
                                        vErrors.push(err123);
                                      }
                                      errors2++;
                                      break;
                                    }
                                  }
                                  if (_errs134 === errors2) {
                                    if (data24.basis !== void 0) {
                                      const _errs135 = errors2;
                                      if ("fiscal-year" !== data24.basis) {
                                        const err124 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/basis/const", keyword: "const", params: { allowedValue: "fiscal-year" }, message: "must be equal to constant" };
                                        if (vErrors === null) {
                                          vErrors = [err124];
                                        } else {
                                          vErrors.push(err124);
                                        }
                                        errors2++;
                                      }
                                      var valid26 = _errs135 === errors2;
                                    } else {
                                      var valid26 = true;
                                    }
                                    if (valid26) {
                                      if (data24.year !== void 0) {
                                        let data44 = data24.year;
                                        const _errs136 = errors2;
                                        if (!(typeof data44 == "number" && (!(data44 % 1) && !isNaN(data44)) && isFinite(data44))) {
                                          const err125 = { instancePath: instancePath + "/windowRequest/year", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/year/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                          if (vErrors === null) {
                                            vErrors = [err125];
                                          } else {
                                            vErrors.push(err125);
                                          }
                                          errors2++;
                                        }
                                        if (errors2 === _errs136) {
                                          if (typeof data44 == "number" && isFinite(data44)) {
                                            if (data44 > 3e3 || isNaN(data44)) {
                                              const err126 = { instancePath: instancePath + "/windowRequest/year", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/year/maximum", keyword: "maximum", params: { comparison: "<=", limit: 3e3 }, message: "must be <= 3000" };
                                              if (vErrors === null) {
                                                vErrors = [err126];
                                              } else {
                                                vErrors.push(err126);
                                              }
                                              errors2++;
                                            } else {
                                              if (data44 < 1900 || isNaN(data44)) {
                                                const err127 = { instancePath: instancePath + "/windowRequest/year", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/year/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1900 }, message: "must be >= 1900" };
                                                if (vErrors === null) {
                                                  vErrors = [err127];
                                                } else {
                                                  vErrors.push(err127);
                                                }
                                                errors2++;
                                              }
                                            }
                                          }
                                        }
                                        var valid26 = _errs136 === errors2;
                                      } else {
                                        var valid26 = true;
                                      }
                                      if (valid26) {
                                        if (data24.calendarId !== void 0) {
                                          let data45 = data24.calendarId;
                                          const _errs138 = errors2;
                                          if (errors2 === _errs138) {
                                            if (typeof data45 === "string") {
                                              if (func2(data45) > 128) {
                                                const err128 = { instancePath: instancePath + "/windowRequest/calendarId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/calendarId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
                                                if (vErrors === null) {
                                                  vErrors = [err128];
                                                } else {
                                                  vErrors.push(err128);
                                                }
                                                errors2++;
                                              } else {
                                                if (func2(data45) < 1) {
                                                  const err129 = { instancePath: instancePath + "/windowRequest/calendarId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/calendarId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                                  if (vErrors === null) {
                                                    vErrors = [err129];
                                                  } else {
                                                    vErrors.push(err129);
                                                  }
                                                  errors2++;
                                                } else {
                                                  if (!pattern9.test(data45)) {
                                                    const err130 = { instancePath: instancePath + "/windowRequest/calendarId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/calendarId/pattern", keyword: "pattern", params: { pattern: "^[a-z][a-z0-9_.-]*$" }, message: 'must match pattern "^[a-z][a-z0-9_.-]*$"' };
                                                    if (vErrors === null) {
                                                      vErrors = [err130];
                                                    } else {
                                                      vErrors.push(err130);
                                                    }
                                                    errors2++;
                                                  }
                                                }
                                              }
                                            } else {
                                              const err131 = { instancePath: instancePath + "/windowRequest/calendarId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/calendarId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                              if (vErrors === null) {
                                                vErrors = [err131];
                                              } else {
                                                vErrors.push(err131);
                                              }
                                              errors2++;
                                            }
                                          }
                                          var valid26 = _errs138 === errors2;
                                        } else {
                                          var valid26 = true;
                                        }
                                        if (valid26) {
                                          if (data24.stage !== void 0) {
                                            let data46 = data24.stage;
                                            const _errs140 = errors2;
                                            if (typeof data46 !== "string") {
                                              const err132 = { instancePath: instancePath + "/windowRequest/stage", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/stage/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                              if (vErrors === null) {
                                                vErrors = [err132];
                                              } else {
                                                vErrors.push(err132);
                                              }
                                              errors2++;
                                            }
                                            if (!(data46 === "requested" || data46 === "authorized" || data46 === "appropriated" || data46 === "obligated" || data46 === "actual" || data46 === "outlay")) {
                                              const err133 = { instancePath: instancePath + "/windowRequest/stage", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/stage/enum", keyword: "enum", params: { allowedValues: schema34.oneOf[5].properties.stage.enum }, message: "must be equal to one of the allowed values" };
                                              if (vErrors === null) {
                                                vErrors = [err133];
                                              } else {
                                                vErrors.push(err133);
                                              }
                                              errors2++;
                                            }
                                            var valid26 = _errs140 === errors2;
                                          } else {
                                            var valid26 = true;
                                          }
                                          if (valid26) {
                                            if (data24.revisionId !== void 0) {
                                              let data47 = data24.revisionId;
                                              const _errs142 = errors2;
                                              if (errors2 === _errs142) {
                                                if (typeof data47 === "string") {
                                                  if (func2(data47) > 256) {
                                                    const err134 = { instancePath: instancePath + "/windowRequest/revisionId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/revisionId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" };
                                                    if (vErrors === null) {
                                                      vErrors = [err134];
                                                    } else {
                                                      vErrors.push(err134);
                                                    }
                                                    errors2++;
                                                  } else {
                                                    if (func2(data47) < 1) {
                                                      const err135 = { instancePath: instancePath + "/windowRequest/revisionId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/revisionId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                                      if (vErrors === null) {
                                                        vErrors = [err135];
                                                      } else {
                                                        vErrors.push(err135);
                                                      }
                                                      errors2++;
                                                    }
                                                  }
                                                } else {
                                                  const err136 = { instancePath: instancePath + "/windowRequest/revisionId", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/revisionId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                  if (vErrors === null) {
                                                    vErrors = [err136];
                                                  } else {
                                                    vErrors.push(err136);
                                                  }
                                                  errors2++;
                                                }
                                              }
                                              var valid26 = _errs142 === errors2;
                                            } else {
                                              var valid26 = true;
                                            }
                                            if (valid26) {
                                              if (data24.timezone !== void 0) {
                                                let data48 = data24.timezone;
                                                const _errs144 = errors2;
                                                if (errors2 === _errs144) {
                                                  if (typeof data48 === "string") {
                                                    if (func2(data48) > 100) {
                                                      const err137 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/timezone/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" };
                                                      if (vErrors === null) {
                                                        vErrors = [err137];
                                                      } else {
                                                        vErrors.push(err137);
                                                      }
                                                      errors2++;
                                                    } else {
                                                      if (func2(data48) < 1) {
                                                        const err138 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/timezone/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                                        if (vErrors === null) {
                                                          vErrors = [err138];
                                                        } else {
                                                          vErrors.push(err138);
                                                        }
                                                        errors2++;
                                                      }
                                                    }
                                                  } else {
                                                    const err139 = { instancePath: instancePath + "/windowRequest/timezone", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/properties/timezone/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                    if (vErrors === null) {
                                                      vErrors = [err139];
                                                    } else {
                                                      vErrors.push(err139);
                                                    }
                                                    errors2++;
                                                  }
                                                }
                                                var valid26 = _errs144 === errors2;
                                              } else {
                                                var valid26 = true;
                                              }
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              } else {
                                const err140 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/5/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                                if (vErrors === null) {
                                  vErrors = [err140];
                                } else {
                                  vErrors.push(err140);
                                }
                                errors2++;
                              }
                            }
                            var _valid9 = _errs132 === errors2;
                            if (_valid9 && valid20) {
                              valid20 = false;
                              passing1 = [passing1, 5];
                            } else {
                              if (_valid9) {
                                valid20 = true;
                                passing1 = 5;
                                if (props5 !== true) {
                                  props5 = true;
                                }
                              }
                              const _errs146 = errors2;
                              if (errors2 === _errs146) {
                                if (data24 && typeof data24 == "object" && !Array.isArray(data24)) {
                                  let missing14;
                                  if (data24.basis === void 0 && (missing14 = "basis")) {
                                    const err141 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/6/required", keyword: "required", params: { missingProperty: missing14 }, message: "must have required property '" + missing14 + "'" };
                                    if (vErrors === null) {
                                      vErrors = [err141];
                                    } else {
                                      vErrors.push(err141);
                                    }
                                    errors2++;
                                  } else {
                                    const _errs148 = errors2;
                                    for (const key10 in data24) {
                                      if (!(key10 === "basis")) {
                                        const err142 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/6/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key10 }, message: "must NOT have additional properties" };
                                        if (vErrors === null) {
                                          vErrors = [err142];
                                        } else {
                                          vErrors.push(err142);
                                        }
                                        errors2++;
                                        break;
                                      }
                                    }
                                    if (_errs148 === errors2) {
                                      if (data24.basis !== void 0) {
                                        if ("unbounded" !== data24.basis) {
                                          const err143 = { instancePath: instancePath + "/windowRequest/basis", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/6/properties/basis/const", keyword: "const", params: { allowedValue: "unbounded" }, message: "must be equal to constant" };
                                          if (vErrors === null) {
                                            vErrors = [err143];
                                          } else {
                                            vErrors.push(err143);
                                          }
                                          errors2++;
                                        }
                                      }
                                    }
                                  }
                                } else {
                                  const err144 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf/6/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                                  if (vErrors === null) {
                                    vErrors = [err144];
                                  } else {
                                    vErrors.push(err144);
                                  }
                                  errors2++;
                                }
                              }
                              var _valid9 = _errs146 === errors2;
                              if (_valid9 && valid20) {
                                valid20 = false;
                                passing1 = [passing1, 6];
                              } else {
                                if (_valid9) {
                                  valid20 = true;
                                  passing1 = 6;
                                  if (props5 !== true) {
                                    props5 = true;
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                    if (!valid20) {
                      const err145 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/$defs/Canonical_Canonical_WindowRequest_f314f340_6d73f042/oneOf", keyword: "oneOf", params: { passingSchemas: passing1 }, message: "must match exactly one schema in oneOf" };
                      if (vErrors === null) {
                        vErrors = [err145];
                      } else {
                        vErrors.push(err145);
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
                    var _valid8 = _errs83 === errors2;
                    valid18 = valid18 || _valid8;
                    const _errs150 = errors2;
                    if (data24 !== null) {
                      const err146 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/properties/windowRequest/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                      if (vErrors === null) {
                        vErrors = [err146];
                      } else {
                        vErrors.push(err146);
                      }
                      errors2++;
                    }
                    var _valid8 = _errs150 === errors2;
                    valid18 = valid18 || _valid8;
                    if (!valid18) {
                      const err147 = { instancePath: instancePath + "/windowRequest", schemaPath: "#/properties/windowRequest/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                      if (vErrors === null) {
                        vErrors = [err147];
                      } else {
                        vErrors.push(err147);
                      }
                      errors2++;
                      validate33.errors = vErrors;
                      return false;
                    } else {
                      errors2 = _errs82;
                      if (vErrors !== null) {
                        if (_errs82) {
                          vErrors.length = _errs82;
                        } else {
                          vErrors = null;
                        }
                      }
                    }
                    var valid9 = _errs81 === errors2;
                  } else {
                    var valid9 = true;
                  }
                  if (valid9) {
                    if (data.modelSelection !== void 0) {
                      let data50 = data.modelSelection;
                      const _errs152 = errors2;
                      if (errors2 === _errs152) {
                        if (data50 && typeof data50 == "object" && !Array.isArray(data50)) {
                          let missing15;
                          if (data50.provider === void 0 && (missing15 = "provider") || data50.modelId === void 0 && (missing15 = "modelId") || data50.effort === void 0 && (missing15 = "effort")) {
                            validate33.errors = [{ instancePath: instancePath + "/modelSelection", schemaPath: "#/properties/modelSelection/required", keyword: "required", params: { missingProperty: missing15 }, message: "must have required property '" + missing15 + "'" }];
                            return false;
                          } else {
                            const _errs154 = errors2;
                            for (const key11 in data50) {
                              if (!(key11 === "provider" || key11 === "modelId" || key11 === "effort")) {
                                validate33.errors = [{ instancePath: instancePath + "/modelSelection", schemaPath: "#/properties/modelSelection/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key11 }, message: "must NOT have additional properties" }];
                                return false;
                                break;
                              }
                            }
                            if (_errs154 === errors2) {
                              if (data50.provider !== void 0) {
                                let data51 = data50.provider;
                                const _errs155 = errors2;
                                if (!(data51 === "bedrock" || data51 === "claude-api")) {
                                  validate33.errors = [{ instancePath: instancePath + "/modelSelection/provider", schemaPath: "#/properties/modelSelection/properties/provider/enum", keyword: "enum", params: { allowedValues: schema38.properties.modelSelection.properties.provider.enum }, message: "must be equal to one of the allowed values" }];
                                  return false;
                                }
                                var valid28 = _errs155 === errors2;
                              } else {
                                var valid28 = true;
                              }
                              if (valid28) {
                                if (data50.modelId !== void 0) {
                                  let data52 = data50.modelId;
                                  const _errs156 = errors2;
                                  if (errors2 === _errs156) {
                                    if (typeof data52 === "string") {
                                      if (!pattern11.test(data52)) {
                                        validate33.errors = [{ instancePath: instancePath + "/modelSelection/modelId", schemaPath: "#/properties/modelSelection/properties/modelId/pattern", keyword: "pattern", params: { pattern: "^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$" }, message: 'must match pattern "^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$"' }];
                                        return false;
                                      }
                                    } else {
                                      validate33.errors = [{ instancePath: instancePath + "/modelSelection/modelId", schemaPath: "#/properties/modelSelection/properties/modelId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                      return false;
                                    }
                                  }
                                  var valid28 = _errs156 === errors2;
                                } else {
                                  var valid28 = true;
                                }
                                if (valid28) {
                                  if (data50.effort !== void 0) {
                                    let data53 = data50.effort;
                                    const _errs158 = errors2;
                                    const _errs159 = errors2;
                                    let valid29 = false;
                                    const _errs160 = errors2;
                                    if (data53 !== null) {
                                      const err148 = { instancePath: instancePath + "/modelSelection/effort", schemaPath: "#/properties/modelSelection/properties/effort/anyOf/0/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                      if (vErrors === null) {
                                        vErrors = [err148];
                                      } else {
                                        vErrors.push(err148);
                                      }
                                      errors2++;
                                    }
                                    var _valid10 = _errs160 === errors2;
                                    valid29 = valid29 || _valid10;
                                    const _errs162 = errors2;
                                    if (typeof data53 !== "string") {
                                      const err149 = { instancePath: instancePath + "/modelSelection/effort", schemaPath: "#/properties/modelSelection/properties/effort/anyOf/1/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                      if (vErrors === null) {
                                        vErrors = [err149];
                                      } else {
                                        vErrors.push(err149);
                                      }
                                      errors2++;
                                    }
                                    if (!(data53 === "low" || data53 === "medium" || data53 === "high" || data53 === "xhigh" || data53 === "max")) {
                                      const err150 = { instancePath: instancePath + "/modelSelection/effort", schemaPath: "#/properties/modelSelection/properties/effort/anyOf/1/enum", keyword: "enum", params: { allowedValues: schema38.properties.modelSelection.properties.effort.anyOf[1].enum }, message: "must be equal to one of the allowed values" };
                                      if (vErrors === null) {
                                        vErrors = [err150];
                                      } else {
                                        vErrors.push(err150);
                                      }
                                      errors2++;
                                    }
                                    var _valid10 = _errs162 === errors2;
                                    valid29 = valid29 || _valid10;
                                    if (!valid29) {
                                      const err151 = { instancePath: instancePath + "/modelSelection/effort", schemaPath: "#/properties/modelSelection/properties/effort/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                      if (vErrors === null) {
                                        vErrors = [err151];
                                      } else {
                                        vErrors.push(err151);
                                      }
                                      errors2++;
                                      validate33.errors = vErrors;
                                      return false;
                                    } else {
                                      errors2 = _errs159;
                                      if (vErrors !== null) {
                                        if (_errs159) {
                                          vErrors.length = _errs159;
                                        } else {
                                          vErrors = null;
                                        }
                                      }
                                    }
                                    var valid28 = _errs158 === errors2;
                                  } else {
                                    var valid28 = true;
                                  }
                                }
                              }
                            }
                          }
                        } else {
                          validate33.errors = [{ instancePath: instancePath + "/modelSelection", schemaPath: "#/properties/modelSelection/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                          return false;
                        }
                      }
                      var valid9 = _errs152 === errors2;
                    } else {
                      var valid9 = true;
                    }
                    if (valid9) {
                      if (data.documentRevision !== void 0) {
                        let data54 = data.documentRevision;
                        const _errs164 = errors2;
                        if (errors2 === _errs164) {
                          if (data54 && typeof data54 == "object" && !Array.isArray(data54)) {
                            let missing16;
                            if (data54.artifactId === void 0 && (missing16 = "artifactId") || data54.versionId === void 0 && (missing16 = "versionId") || data54.objectSha256 === void 0 && (missing16 = "objectSha256")) {
                              validate33.errors = [{ instancePath: instancePath + "/documentRevision", schemaPath: "#/properties/documentRevision/required", keyword: "required", params: { missingProperty: missing16 }, message: "must have required property '" + missing16 + "'" }];
                              return false;
                            } else {
                              const _errs166 = errors2;
                              for (const key12 in data54) {
                                if (!(key12 === "artifactId" || key12 === "versionId" || key12 === "objectSha256")) {
                                  validate33.errors = [{ instancePath: instancePath + "/documentRevision", schemaPath: "#/properties/documentRevision/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key12 }, message: "must NOT have additional properties" }];
                                  return false;
                                  break;
                                }
                              }
                              if (_errs166 === errors2) {
                                if (data54.artifactId !== void 0) {
                                  let data55 = data54.artifactId;
                                  const _errs167 = errors2;
                                  if (errors2 === _errs167) {
                                    if (typeof data55 === "string") {
                                      if (!pattern4.test(data55)) {
                                        validate33.errors = [{ instancePath: instancePath + "/documentRevision/artifactId", schemaPath: "#/properties/documentRevision/properties/artifactId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' }];
                                        return false;
                                      }
                                    } else {
                                      validate33.errors = [{ instancePath: instancePath + "/documentRevision/artifactId", schemaPath: "#/properties/documentRevision/properties/artifactId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                      return false;
                                    }
                                  }
                                  var valid30 = _errs167 === errors2;
                                } else {
                                  var valid30 = true;
                                }
                                if (valid30) {
                                  if (data54.versionId !== void 0) {
                                    let data56 = data54.versionId;
                                    const _errs169 = errors2;
                                    if (errors2 === _errs169) {
                                      if (typeof data56 === "string") {
                                        if (!pattern4.test(data56)) {
                                          validate33.errors = [{ instancePath: instancePath + "/documentRevision/versionId", schemaPath: "#/properties/documentRevision/properties/versionId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' }];
                                          return false;
                                        }
                                      } else {
                                        validate33.errors = [{ instancePath: instancePath + "/documentRevision/versionId", schemaPath: "#/properties/documentRevision/properties/versionId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                        return false;
                                      }
                                    }
                                    var valid30 = _errs169 === errors2;
                                  } else {
                                    var valid30 = true;
                                  }
                                  if (valid30) {
                                    if (data54.objectSha256 !== void 0) {
                                      let data57 = data54.objectSha256;
                                      const _errs171 = errors2;
                                      if (errors2 === _errs171) {
                                        if (typeof data57 === "string") {
                                          if (!pattern14.test(data57)) {
                                            validate33.errors = [{ instancePath: instancePath + "/documentRevision/objectSha256", schemaPath: "#/properties/documentRevision/properties/objectSha256/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{64}$" }, message: 'must match pattern "^[0-9a-f]{64}$"' }];
                                            return false;
                                          }
                                        } else {
                                          validate33.errors = [{ instancePath: instancePath + "/documentRevision/objectSha256", schemaPath: "#/properties/documentRevision/properties/objectSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                          return false;
                                        }
                                      }
                                      var valid30 = _errs171 === errors2;
                                    } else {
                                      var valid30 = true;
                                    }
                                  }
                                }
                              }
                            }
                          } else {
                            validate33.errors = [{ instancePath: instancePath + "/documentRevision", schemaPath: "#/properties/documentRevision/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                            return false;
                          }
                        }
                        var valid9 = _errs164 === errors2;
                      } else {
                        var valid9 = true;
                      }
                      if (valid9) {
                        if (data.uploads !== void 0) {
                          let data58 = data.uploads;
                          const _errs173 = errors2;
                          if (errors2 === _errs173) {
                            if (Array.isArray(data58)) {
                              if (data58.length > 8) {
                                validate33.errors = [{ instancePath: instancePath + "/uploads", schemaPath: "#/properties/uploads/maxItems", keyword: "maxItems", params: { limit: 8 }, message: "must NOT have more than 8 items" }];
                                return false;
                              } else {
                                if (data58.length < 1) {
                                  validate33.errors = [{ instancePath: instancePath + "/uploads", schemaPath: "#/properties/uploads/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                                  return false;
                                } else {
                                  var valid31 = true;
                                  const len0 = data58.length;
                                  for (let i0 = 0; i0 < len0; i0++) {
                                    let data59 = data58[i0];
                                    const _errs175 = errors2;
                                    if (errors2 === _errs175) {
                                      if (data59 && typeof data59 == "object" && !Array.isArray(data59)) {
                                        let missing17;
                                        if (data59.uploadId === void 0 && (missing17 = "uploadId") || data59.sha256 === void 0 && (missing17 = "sha256")) {
                                          validate33.errors = [{ instancePath: instancePath + "/uploads/" + i0, schemaPath: "#/properties/uploads/items/required", keyword: "required", params: { missingProperty: missing17 }, message: "must have required property '" + missing17 + "'" }];
                                          return false;
                                        } else {
                                          const _errs177 = errors2;
                                          for (const key13 in data59) {
                                            if (!(key13 === "uploadId" || key13 === "sha256")) {
                                              validate33.errors = [{ instancePath: instancePath + "/uploads/" + i0, schemaPath: "#/properties/uploads/items/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key13 }, message: "must NOT have additional properties" }];
                                              return false;
                                              break;
                                            }
                                          }
                                          if (_errs177 === errors2) {
                                            if (data59.uploadId !== void 0) {
                                              let data60 = data59.uploadId;
                                              const _errs178 = errors2;
                                              if (errors2 === _errs178) {
                                                if (typeof data60 === "string") {
                                                  if (!pattern4.test(data60)) {
                                                    validate33.errors = [{ instancePath: instancePath + "/uploads/" + i0 + "/uploadId", schemaPath: "#/properties/uploads/items/properties/uploadId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' }];
                                                    return false;
                                                  }
                                                } else {
                                                  validate33.errors = [{ instancePath: instancePath + "/uploads/" + i0 + "/uploadId", schemaPath: "#/properties/uploads/items/properties/uploadId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                  return false;
                                                }
                                              }
                                              var valid32 = _errs178 === errors2;
                                            } else {
                                              var valid32 = true;
                                            }
                                            if (valid32) {
                                              if (data59.sha256 !== void 0) {
                                                let data61 = data59.sha256;
                                                const _errs180 = errors2;
                                                if (errors2 === _errs180) {
                                                  if (typeof data61 === "string") {
                                                    if (!pattern14.test(data61)) {
                                                      validate33.errors = [{ instancePath: instancePath + "/uploads/" + i0 + "/sha256", schemaPath: "#/properties/uploads/items/properties/sha256/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{64}$" }, message: 'must match pattern "^[0-9a-f]{64}$"' }];
                                                      return false;
                                                    }
                                                  } else {
                                                    validate33.errors = [{ instancePath: instancePath + "/uploads/" + i0 + "/sha256", schemaPath: "#/properties/uploads/items/properties/sha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                    return false;
                                                  }
                                                }
                                                var valid32 = _errs180 === errors2;
                                              } else {
                                                var valid32 = true;
                                              }
                                            }
                                          }
                                        }
                                      } else {
                                        validate33.errors = [{ instancePath: instancePath + "/uploads/" + i0, schemaPath: "#/properties/uploads/items/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                        return false;
                                      }
                                    }
                                    var valid31 = _errs175 === errors2;
                                    if (!valid31) {
                                      break;
                                    }
                                  }
                                  if (valid31) {
                                    let i1 = data58.length;
                                    let j0;
                                    if (i1 > 1) {
                                      outer0: for (; i1--; ) {
                                        for (j0 = i1; j0--; ) {
                                          if (func0(data58[i1], data58[j0])) {
                                            validate33.errors = [{ instancePath: instancePath + "/uploads", schemaPath: "#/properties/uploads/uniqueItems", keyword: "uniqueItems", params: { i: i1, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)" }];
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
                              validate33.errors = [{ instancePath: instancePath + "/uploads", schemaPath: "#/properties/uploads/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                              return false;
                            }
                          }
                          var valid9 = _errs173 === errors2;
                        } else {
                          var valid9 = true;
                        }
                        if (valid9) {
                          if (data.procedure !== void 0) {
                            let data62 = data.procedure;
                            const _errs182 = errors2;
                            const _errs183 = errors2;
                            let valid34 = false;
                            let passing2 = null;
                            const _errs184 = errors2;
                            if (errors2 === _errs184) {
                              if (data62 && typeof data62 == "object" && !Array.isArray(data62)) {
                                let missing18;
                                if (data62.source === void 0 && (missing18 = "source") || data62.recordId === void 0 && (missing18 = "recordId") || data62.version === void 0 && (missing18 = "version") || data62.manifestDigest === void 0 && (missing18 = "manifestDigest")) {
                                  const err152 = { instancePath: instancePath + "/procedure", schemaPath: "#/properties/procedure/oneOf/0/required", keyword: "required", params: { missingProperty: missing18 }, message: "must have required property '" + missing18 + "'" };
                                  if (vErrors === null) {
                                    vErrors = [err152];
                                  } else {
                                    vErrors.push(err152);
                                  }
                                  errors2++;
                                } else {
                                  const _errs186 = errors2;
                                  for (const key14 in data62) {
                                    if (!(key14 === "source" || key14 === "recordId" || key14 === "version" || key14 === "manifestDigest")) {
                                      const err153 = { instancePath: instancePath + "/procedure", schemaPath: "#/properties/procedure/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key14 }, message: "must NOT have additional properties" };
                                      if (vErrors === null) {
                                        vErrors = [err153];
                                      } else {
                                        vErrors.push(err153);
                                      }
                                      errors2++;
                                      break;
                                    }
                                  }
                                  if (_errs186 === errors2) {
                                    if (data62.source !== void 0) {
                                      const _errs187 = errors2;
                                      if ("firm" !== data62.source) {
                                        const err154 = { instancePath: instancePath + "/procedure/source", schemaPath: "#/properties/procedure/oneOf/0/properties/source/const", keyword: "const", params: { allowedValue: "firm" }, message: "must be equal to constant" };
                                        if (vErrors === null) {
                                          vErrors = [err154];
                                        } else {
                                          vErrors.push(err154);
                                        }
                                        errors2++;
                                      }
                                      var valid35 = _errs187 === errors2;
                                    } else {
                                      var valid35 = true;
                                    }
                                    if (valid35) {
                                      if (data62.recordId !== void 0) {
                                        let data64 = data62.recordId;
                                        const _errs188 = errors2;
                                        if (errors2 === _errs188) {
                                          if (typeof data64 === "string") {
                                            if (!pattern4.test(data64)) {
                                              const err155 = { instancePath: instancePath + "/procedure/recordId", schemaPath: "#/properties/procedure/oneOf/0/properties/recordId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' };
                                              if (vErrors === null) {
                                                vErrors = [err155];
                                              } else {
                                                vErrors.push(err155);
                                              }
                                              errors2++;
                                            }
                                          } else {
                                            const err156 = { instancePath: instancePath + "/procedure/recordId", schemaPath: "#/properties/procedure/oneOf/0/properties/recordId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                            if (vErrors === null) {
                                              vErrors = [err156];
                                            } else {
                                              vErrors.push(err156);
                                            }
                                            errors2++;
                                          }
                                        }
                                        var valid35 = _errs188 === errors2;
                                      } else {
                                        var valid35 = true;
                                      }
                                      if (valid35) {
                                        if (data62.version !== void 0) {
                                          let data65 = data62.version;
                                          const _errs190 = errors2;
                                          if (!(typeof data65 == "number" && (!(data65 % 1) && !isNaN(data65)) && isFinite(data65))) {
                                            const err157 = { instancePath: instancePath + "/procedure/version", schemaPath: "#/properties/procedure/oneOf/0/properties/version/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                            if (vErrors === null) {
                                              vErrors = [err157];
                                            } else {
                                              vErrors.push(err157);
                                            }
                                            errors2++;
                                          }
                                          if (errors2 === _errs190) {
                                            if (typeof data65 == "number" && isFinite(data65)) {
                                              if (data65 > 9007199254740991 || isNaN(data65)) {
                                                const err158 = { instancePath: instancePath + "/procedure/version", schemaPath: "#/properties/procedure/oneOf/0/properties/version/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                                if (vErrors === null) {
                                                  vErrors = [err158];
                                                } else {
                                                  vErrors.push(err158);
                                                }
                                                errors2++;
                                              } else {
                                                if (data65 < 1 || isNaN(data65)) {
                                                  const err159 = { instancePath: instancePath + "/procedure/version", schemaPath: "#/properties/procedure/oneOf/0/properties/version/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                                                  if (vErrors === null) {
                                                    vErrors = [err159];
                                                  } else {
                                                    vErrors.push(err159);
                                                  }
                                                  errors2++;
                                                }
                                              }
                                            }
                                          }
                                          var valid35 = _errs190 === errors2;
                                        } else {
                                          var valid35 = true;
                                        }
                                        if (valid35) {
                                          if (data62.manifestDigest !== void 0) {
                                            let data66 = data62.manifestDigest;
                                            const _errs192 = errors2;
                                            if (errors2 === _errs192) {
                                              if (typeof data66 === "string") {
                                                if (!pattern18.test(data66)) {
                                                  const err160 = { instancePath: instancePath + "/procedure/manifestDigest", schemaPath: "#/properties/procedure/oneOf/0/properties/manifestDigest/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' };
                                                  if (vErrors === null) {
                                                    vErrors = [err160];
                                                  } else {
                                                    vErrors.push(err160);
                                                  }
                                                  errors2++;
                                                }
                                              } else {
                                                const err161 = { instancePath: instancePath + "/procedure/manifestDigest", schemaPath: "#/properties/procedure/oneOf/0/properties/manifestDigest/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                if (vErrors === null) {
                                                  vErrors = [err161];
                                                } else {
                                                  vErrors.push(err161);
                                                }
                                                errors2++;
                                              }
                                            }
                                            var valid35 = _errs192 === errors2;
                                          } else {
                                            var valid35 = true;
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              } else {
                                const err162 = { instancePath: instancePath + "/procedure", schemaPath: "#/properties/procedure/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                                if (vErrors === null) {
                                  vErrors = [err162];
                                } else {
                                  vErrors.push(err162);
                                }
                                errors2++;
                              }
                            }
                            var _valid11 = _errs184 === errors2;
                            if (_valid11) {
                              valid34 = true;
                              passing2 = 0;
                              var props6 = true;
                            }
                            const _errs194 = errors2;
                            if (errors2 === _errs194) {
                              if (data62 && typeof data62 == "object" && !Array.isArray(data62)) {
                                let missing19;
                                if (data62.source === void 0 && (missing19 = "source") || data62.id === void 0 && (missing19 = "id") || data62.version === void 0 && (missing19 = "version") || data62.manifestDigest === void 0 && (missing19 = "manifestDigest")) {
                                  const err163 = { instancePath: instancePath + "/procedure", schemaPath: "#/properties/procedure/oneOf/1/required", keyword: "required", params: { missingProperty: missing19 }, message: "must have required property '" + missing19 + "'" };
                                  if (vErrors === null) {
                                    vErrors = [err163];
                                  } else {
                                    vErrors.push(err163);
                                  }
                                  errors2++;
                                } else {
                                  const _errs196 = errors2;
                                  for (const key15 in data62) {
                                    if (!(key15 === "source" || key15 === "id" || key15 === "version" || key15 === "manifestDigest")) {
                                      const err164 = { instancePath: instancePath + "/procedure", schemaPath: "#/properties/procedure/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key15 }, message: "must NOT have additional properties" };
                                      if (vErrors === null) {
                                        vErrors = [err164];
                                      } else {
                                        vErrors.push(err164);
                                      }
                                      errors2++;
                                      break;
                                    }
                                  }
                                  if (_errs196 === errors2) {
                                    if (data62.source !== void 0) {
                                      const _errs197 = errors2;
                                      if ("builtin" !== data62.source) {
                                        const err165 = { instancePath: instancePath + "/procedure/source", schemaPath: "#/properties/procedure/oneOf/1/properties/source/const", keyword: "const", params: { allowedValue: "builtin" }, message: "must be equal to constant" };
                                        if (vErrors === null) {
                                          vErrors = [err165];
                                        } else {
                                          vErrors.push(err165);
                                        }
                                        errors2++;
                                      }
                                      var valid36 = _errs197 === errors2;
                                    } else {
                                      var valid36 = true;
                                    }
                                    if (valid36) {
                                      if (data62.id !== void 0) {
                                        let data68 = data62.id;
                                        const _errs198 = errors2;
                                        if (!(data68 === "briefing" || data68 === "draft" || data68 === "bill_analysis" || data68 === "hearing_prep" || data68 === "coalition_letter" || data68 === "amendment_tracker")) {
                                          const err166 = { instancePath: instancePath + "/procedure/id", schemaPath: "#/properties/procedure/oneOf/1/properties/id/enum", keyword: "enum", params: { allowedValues: schema38.properties.procedure.oneOf[1].properties.id.enum }, message: "must be equal to one of the allowed values" };
                                          if (vErrors === null) {
                                            vErrors = [err166];
                                          } else {
                                            vErrors.push(err166);
                                          }
                                          errors2++;
                                        }
                                        var valid36 = _errs198 === errors2;
                                      } else {
                                        var valid36 = true;
                                      }
                                      if (valid36) {
                                        if (data62.version !== void 0) {
                                          let data69 = data62.version;
                                          const _errs199 = errors2;
                                          if (!(typeof data69 == "number" && (!(data69 % 1) && !isNaN(data69)) && isFinite(data69))) {
                                            const err167 = { instancePath: instancePath + "/procedure/version", schemaPath: "#/properties/procedure/oneOf/1/properties/version/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                            if (vErrors === null) {
                                              vErrors = [err167];
                                            } else {
                                              vErrors.push(err167);
                                            }
                                            errors2++;
                                          }
                                          if (errors2 === _errs199) {
                                            if (typeof data69 == "number" && isFinite(data69)) {
                                              if (data69 > 9007199254740991 || isNaN(data69)) {
                                                const err168 = { instancePath: instancePath + "/procedure/version", schemaPath: "#/properties/procedure/oneOf/1/properties/version/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                                if (vErrors === null) {
                                                  vErrors = [err168];
                                                } else {
                                                  vErrors.push(err168);
                                                }
                                                errors2++;
                                              } else {
                                                if (data69 < 1 || isNaN(data69)) {
                                                  const err169 = { instancePath: instancePath + "/procedure/version", schemaPath: "#/properties/procedure/oneOf/1/properties/version/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                                                  if (vErrors === null) {
                                                    vErrors = [err169];
                                                  } else {
                                                    vErrors.push(err169);
                                                  }
                                                  errors2++;
                                                }
                                              }
                                            }
                                          }
                                          var valid36 = _errs199 === errors2;
                                        } else {
                                          var valid36 = true;
                                        }
                                        if (valid36) {
                                          if (data62.manifestDigest !== void 0) {
                                            let data70 = data62.manifestDigest;
                                            const _errs201 = errors2;
                                            if (errors2 === _errs201) {
                                              if (typeof data70 === "string") {
                                                if (!pattern18.test(data70)) {
                                                  const err170 = { instancePath: instancePath + "/procedure/manifestDigest", schemaPath: "#/properties/procedure/oneOf/1/properties/manifestDigest/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' };
                                                  if (vErrors === null) {
                                                    vErrors = [err170];
                                                  } else {
                                                    vErrors.push(err170);
                                                  }
                                                  errors2++;
                                                }
                                              } else {
                                                const err171 = { instancePath: instancePath + "/procedure/manifestDigest", schemaPath: "#/properties/procedure/oneOf/1/properties/manifestDigest/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                if (vErrors === null) {
                                                  vErrors = [err171];
                                                } else {
                                                  vErrors.push(err171);
                                                }
                                                errors2++;
                                              }
                                            }
                                            var valid36 = _errs201 === errors2;
                                          } else {
                                            var valid36 = true;
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              } else {
                                const err172 = { instancePath: instancePath + "/procedure", schemaPath: "#/properties/procedure/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                                if (vErrors === null) {
                                  vErrors = [err172];
                                } else {
                                  vErrors.push(err172);
                                }
                                errors2++;
                              }
                            }
                            var _valid11 = _errs194 === errors2;
                            if (_valid11 && valid34) {
                              valid34 = false;
                              passing2 = [passing2, 1];
                            } else {
                              if (_valid11) {
                                valid34 = true;
                                passing2 = 1;
                                if (props6 !== true) {
                                  props6 = true;
                                }
                              }
                            }
                            if (!valid34) {
                              const err173 = { instancePath: instancePath + "/procedure", schemaPath: "#/properties/procedure/oneOf", keyword: "oneOf", params: { passingSchemas: passing2 }, message: "must match exactly one schema in oneOf" };
                              if (vErrors === null) {
                                vErrors = [err173];
                              } else {
                                vErrors.push(err173);
                              }
                              errors2++;
                              validate33.errors = vErrors;
                              return false;
                            } else {
                              errors2 = _errs183;
                              if (vErrors !== null) {
                                if (_errs183) {
                                  vErrors.length = _errs183;
                                } else {
                                  vErrors = null;
                                }
                              }
                            }
                            var valid9 = _errs182 === errors2;
                          } else {
                            var valid9 = true;
                          }
                          if (valid9) {
                            if (data.siteWorkflow !== void 0) {
                              let data71 = data.siteWorkflow;
                              const _errs203 = errors2;
                              if (errors2 === _errs203) {
                                if (data71 && typeof data71 == "object" && !Array.isArray(data71)) {
                                  let missing20;
                                  if (data71.siteId === void 0 && (missing20 = "siteId") || data71.workflowId === void 0 && (missing20 = "workflowId") || data71.version === void 0 && (missing20 = "version") || data71.manifestSha256 === void 0 && (missing20 = "manifestSha256")) {
                                    validate33.errors = [{ instancePath: instancePath + "/siteWorkflow", schemaPath: "#/properties/siteWorkflow/required", keyword: "required", params: { missingProperty: missing20 }, message: "must have required property '" + missing20 + "'" }];
                                    return false;
                                  } else {
                                    const _errs205 = errors2;
                                    for (const key16 in data71) {
                                      if (!(key16 === "siteId" || key16 === "workflowId" || key16 === "version" || key16 === "manifestSha256")) {
                                        validate33.errors = [{ instancePath: instancePath + "/siteWorkflow", schemaPath: "#/properties/siteWorkflow/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key16 }, message: "must NOT have additional properties" }];
                                        return false;
                                        break;
                                      }
                                    }
                                    if (_errs205 === errors2) {
                                      if (data71.siteId !== void 0) {
                                        let data72 = data71.siteId;
                                        const _errs206 = errors2;
                                        if (errors2 === _errs206) {
                                          if (typeof data72 === "string") {
                                            if (!pattern20.test(data72)) {
                                              validate33.errors = [{ instancePath: instancePath + "/siteWorkflow/siteId", schemaPath: "#/properties/siteWorkflow/properties/siteId/pattern", keyword: "pattern", params: { pattern: "^[a-z][a-z0-9-]{1,63}$" }, message: 'must match pattern "^[a-z][a-z0-9-]{1,63}$"' }];
                                              return false;
                                            }
                                          } else {
                                            validate33.errors = [{ instancePath: instancePath + "/siteWorkflow/siteId", schemaPath: "#/properties/siteWorkflow/properties/siteId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                            return false;
                                          }
                                        }
                                        var valid37 = _errs206 === errors2;
                                      } else {
                                        var valid37 = true;
                                      }
                                      if (valid37) {
                                        if (data71.workflowId !== void 0) {
                                          let data73 = data71.workflowId;
                                          const _errs208 = errors2;
                                          if (errors2 === _errs208) {
                                            if (typeof data73 === "string") {
                                              if (!pattern20.test(data73)) {
                                                validate33.errors = [{ instancePath: instancePath + "/siteWorkflow/workflowId", schemaPath: "#/properties/siteWorkflow/properties/workflowId/pattern", keyword: "pattern", params: { pattern: "^[a-z][a-z0-9-]{1,63}$" }, message: 'must match pattern "^[a-z][a-z0-9-]{1,63}$"' }];
                                                return false;
                                              }
                                            } else {
                                              validate33.errors = [{ instancePath: instancePath + "/siteWorkflow/workflowId", schemaPath: "#/properties/siteWorkflow/properties/workflowId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                              return false;
                                            }
                                          }
                                          var valid37 = _errs208 === errors2;
                                        } else {
                                          var valid37 = true;
                                        }
                                        if (valid37) {
                                          if (data71.version !== void 0) {
                                            let data74 = data71.version;
                                            const _errs210 = errors2;
                                            if (!(typeof data74 == "number" && (!(data74 % 1) && !isNaN(data74)) && isFinite(data74))) {
                                              validate33.errors = [{ instancePath: instancePath + "/siteWorkflow/version", schemaPath: "#/properties/siteWorkflow/properties/version/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                              return false;
                                            }
                                            if (errors2 === _errs210) {
                                              if (typeof data74 == "number" && isFinite(data74)) {
                                                if (data74 > 9007199254740991 || isNaN(data74)) {
                                                  validate33.errors = [{ instancePath: instancePath + "/siteWorkflow/version", schemaPath: "#/properties/siteWorkflow/properties/version/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                  return false;
                                                } else {
                                                  if (data74 < 1 || isNaN(data74)) {
                                                    validate33.errors = [{ instancePath: instancePath + "/siteWorkflow/version", schemaPath: "#/properties/siteWorkflow/properties/version/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                                                    return false;
                                                  }
                                                }
                                              }
                                            }
                                            var valid37 = _errs210 === errors2;
                                          } else {
                                            var valid37 = true;
                                          }
                                          if (valid37) {
                                            if (data71.manifestSha256 !== void 0) {
                                              let data75 = data71.manifestSha256;
                                              const _errs212 = errors2;
                                              if (errors2 === _errs212) {
                                                if (typeof data75 === "string") {
                                                  if (!pattern18.test(data75)) {
                                                    validate33.errors = [{ instancePath: instancePath + "/siteWorkflow/manifestSha256", schemaPath: "#/properties/siteWorkflow/properties/manifestSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                                    return false;
                                                  }
                                                } else {
                                                  validate33.errors = [{ instancePath: instancePath + "/siteWorkflow/manifestSha256", schemaPath: "#/properties/siteWorkflow/properties/manifestSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                  return false;
                                                }
                                              }
                                              var valid37 = _errs212 === errors2;
                                            } else {
                                              var valid37 = true;
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }
                                } else {
                                  validate33.errors = [{ instancePath: instancePath + "/siteWorkflow", schemaPath: "#/properties/siteWorkflow/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                  return false;
                                }
                              }
                              var valid9 = _errs203 === errors2;
                            } else {
                              var valid9 = true;
                            }
                            if (valid9) {
                              if (data.work !== void 0) {
                                let data76 = data.work;
                                const _errs214 = errors2;
                                if (errors2 === _errs214) {
                                  if (data76 && typeof data76 == "object" && !Array.isArray(data76)) {
                                    let missing21;
                                    if (data76.entry === void 0 && (missing21 = "entry") || data76.jobKind === void 0 && (missing21 = "jobKind") || data76.deliverables === void 0 && (missing21 = "deliverables") || data76.dependencies === void 0 && (missing21 = "dependencies")) {
                                      validate33.errors = [{ instancePath: instancePath + "/work", schemaPath: "#/properties/work/required", keyword: "required", params: { missingProperty: missing21 }, message: "must have required property '" + missing21 + "'" }];
                                      return false;
                                    } else {
                                      const _errs216 = errors2;
                                      for (const key17 in data76) {
                                        if (!(key17 === "entry" || key17 === "jobKind" || key17 === "deliverables" || key17 === "dependencies")) {
                                          validate33.errors = [{ instancePath: instancePath + "/work", schemaPath: "#/properties/work/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key17 }, message: "must NOT have additional properties" }];
                                          return false;
                                          break;
                                        }
                                      }
                                      if (_errs216 === errors2) {
                                        if (data76.entry !== void 0) {
                                          let data77 = data76.entry;
                                          const _errs217 = errors2;
                                          if (!(data77 === "start-work" || data77 === "delegate")) {
                                            validate33.errors = [{ instancePath: instancePath + "/work/entry", schemaPath: "#/properties/work/properties/entry/enum", keyword: "enum", params: { allowedValues: schema38.properties.work.properties.entry.enum }, message: "must be equal to one of the allowed values" }];
                                            return false;
                                          }
                                          var valid38 = _errs217 === errors2;
                                        } else {
                                          var valid38 = true;
                                        }
                                        if (valid38) {
                                          if (data76.jobKind !== void 0) {
                                            let data78 = data76.jobKind;
                                            const _errs218 = errors2;
                                            if (!(data78 === "research" || data78 === "deliverable" || data78 === "audit" || data78 === "scheduled")) {
                                              validate33.errors = [{ instancePath: instancePath + "/work/jobKind", schemaPath: "#/properties/work/properties/jobKind/enum", keyword: "enum", params: { allowedValues: schema38.properties.work.properties.jobKind.enum }, message: "must be equal to one of the allowed values" }];
                                              return false;
                                            }
                                            var valid38 = _errs218 === errors2;
                                          } else {
                                            var valid38 = true;
                                          }
                                          if (valid38) {
                                            if (data76.deliverables !== void 0) {
                                              let data79 = data76.deliverables;
                                              const _errs219 = errors2;
                                              if (errors2 === _errs219) {
                                                if (Array.isArray(data79)) {
                                                  if (data79.length > 20) {
                                                    validate33.errors = [{ instancePath: instancePath + "/work/deliverables", schemaPath: "#/properties/work/properties/deliverables/maxItems", keyword: "maxItems", params: { limit: 20 }, message: "must NOT have more than 20 items" }];
                                                    return false;
                                                  } else {
                                                    var valid39 = true;
                                                    const len1 = data79.length;
                                                    for (let i2 = 0; i2 < len1; i2++) {
                                                      let data80 = data79[i2];
                                                      const _errs221 = errors2;
                                                      if (errors2 === _errs221) {
                                                        if (typeof data80 === "string") {
                                                          if (func2(data80) > 200) {
                                                            validate33.errors = [{ instancePath: instancePath + "/work/deliverables/" + i2, schemaPath: "#/properties/work/properties/deliverables/items/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" }];
                                                            return false;
                                                          } else {
                                                            if (func2(data80) < 1) {
                                                              validate33.errors = [{ instancePath: instancePath + "/work/deliverables/" + i2, schemaPath: "#/properties/work/properties/deliverables/items/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                              return false;
                                                            } else {
                                                              if (!pattern5.test(data80)) {
                                                                validate33.errors = [{ instancePath: instancePath + "/work/deliverables/" + i2, schemaPath: "#/properties/work/properties/deliverables/items/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "\\S"' }];
                                                                return false;
                                                              }
                                                            }
                                                          }
                                                        } else {
                                                          validate33.errors = [{ instancePath: instancePath + "/work/deliverables/" + i2, schemaPath: "#/properties/work/properties/deliverables/items/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                          return false;
                                                        }
                                                      }
                                                      var valid39 = _errs221 === errors2;
                                                      if (!valid39) {
                                                        break;
                                                      }
                                                    }
                                                    if (valid39) {
                                                      let i3 = data79.length;
                                                      let j1;
                                                      if (i3 > 1) {
                                                        const indices0 = {};
                                                        for (; i3--; ) {
                                                          let item0 = data79[i3];
                                                          if (typeof item0 !== "string") {
                                                            continue;
                                                          }
                                                          if (typeof indices0[item0] == "number") {
                                                            j1 = indices0[item0];
                                                            validate33.errors = [{ instancePath: instancePath + "/work/deliverables", schemaPath: "#/properties/work/properties/deliverables/uniqueItems", keyword: "uniqueItems", params: { i: i3, j: j1 }, message: "must NOT have duplicate items (items ## " + j1 + " and " + i3 + " are identical)" }];
                                                            return false;
                                                            break;
                                                          }
                                                          indices0[item0] = i3;
                                                        }
                                                      }
                                                    }
                                                  }
                                                } else {
                                                  validate33.errors = [{ instancePath: instancePath + "/work/deliverables", schemaPath: "#/properties/work/properties/deliverables/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                                  return false;
                                                }
                                              }
                                              var valid38 = _errs219 === errors2;
                                            } else {
                                              var valid38 = true;
                                            }
                                            if (valid38) {
                                              if (data76.dependencies !== void 0) {
                                                let data81 = data76.dependencies;
                                                const _errs223 = errors2;
                                                if (errors2 === _errs223) {
                                                  if (Array.isArray(data81)) {
                                                    if (data81.length > 20) {
                                                      validate33.errors = [{ instancePath: instancePath + "/work/dependencies", schemaPath: "#/properties/work/properties/dependencies/maxItems", keyword: "maxItems", params: { limit: 20 }, message: "must NOT have more than 20 items" }];
                                                      return false;
                                                    } else {
                                                      var valid41 = true;
                                                      const len2 = data81.length;
                                                      for (let i4 = 0; i4 < len2; i4++) {
                                                        let data82 = data81[i4];
                                                        const _errs225 = errors2;
                                                        if (errors2 === _errs225) {
                                                          if (typeof data82 === "string") {
                                                            if (func2(data82) > 200) {
                                                              validate33.errors = [{ instancePath: instancePath + "/work/dependencies/" + i4, schemaPath: "#/properties/work/properties/dependencies/items/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" }];
                                                              return false;
                                                            } else {
                                                              if (func2(data82) < 1) {
                                                                validate33.errors = [{ instancePath: instancePath + "/work/dependencies/" + i4, schemaPath: "#/properties/work/properties/dependencies/items/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                                return false;
                                                              } else {
                                                                if (!pattern5.test(data82)) {
                                                                  validate33.errors = [{ instancePath: instancePath + "/work/dependencies/" + i4, schemaPath: "#/properties/work/properties/dependencies/items/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "\\S"' }];
                                                                  return false;
                                                                }
                                                              }
                                                            }
                                                          } else {
                                                            validate33.errors = [{ instancePath: instancePath + "/work/dependencies/" + i4, schemaPath: "#/properties/work/properties/dependencies/items/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                            return false;
                                                          }
                                                        }
                                                        var valid41 = _errs225 === errors2;
                                                        if (!valid41) {
                                                          break;
                                                        }
                                                      }
                                                      if (valid41) {
                                                        let i5 = data81.length;
                                                        let j2;
                                                        if (i5 > 1) {
                                                          const indices1 = {};
                                                          for (; i5--; ) {
                                                            let item1 = data81[i5];
                                                            if (typeof item1 !== "string") {
                                                              continue;
                                                            }
                                                            if (typeof indices1[item1] == "number") {
                                                              j2 = indices1[item1];
                                                              validate33.errors = [{ instancePath: instancePath + "/work/dependencies", schemaPath: "#/properties/work/properties/dependencies/uniqueItems", keyword: "uniqueItems", params: { i: i5, j: j2 }, message: "must NOT have duplicate items (items ## " + j2 + " and " + i5 + " are identical)" }];
                                                              return false;
                                                              break;
                                                            }
                                                            indices1[item1] = i5;
                                                          }
                                                        }
                                                      }
                                                    }
                                                  } else {
                                                    validate33.errors = [{ instancePath: instancePath + "/work/dependencies", schemaPath: "#/properties/work/properties/dependencies/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                                    return false;
                                                  }
                                                }
                                                var valid38 = _errs223 === errors2;
                                              } else {
                                                var valid38 = true;
                                              }
                                            }
                                          }
                                        }
                                      }
                                    }
                                  } else {
                                    validate33.errors = [{ instancePath: instancePath + "/work", schemaPath: "#/properties/work/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                    return false;
                                  }
                                }
                                var valid9 = _errs214 === errors2;
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
                if (func2(data0) > 128) {
                  validate45.errors = [{ instancePath: instancePath + "/tenantId", schemaPath: "#/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                  return false;
                } else {
                  if (func2(data0) < 1) {
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
                  if (func2(data1) > 128) {
                    validate45.errors = [{ instancePath: instancePath + "/actorId", schemaPath: "#/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                    return false;
                  } else {
                    if (func2(data1) < 1) {
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
                    const _errs11 = errors2;
                    let valid1 = false;
                    const _errs12 = errors2;
                    if (errors2 === _errs12) {
                      if (typeof data4 === "string") {
                        if (!pattern4.test(data4)) {
                          const err0 = { instancePath: instancePath + "/clientId", schemaPath: "#/properties/clientId/anyOf/0/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' };
                          if (vErrors === null) {
                            vErrors = [err0];
                          } else {
                            vErrors.push(err0);
                          }
                          errors2++;
                        }
                      } else {
                        const err1 = { instancePath: instancePath + "/clientId", schemaPath: "#/properties/clientId/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                        if (vErrors === null) {
                          vErrors = [err1];
                        } else {
                          vErrors.push(err1);
                        }
                        errors2++;
                      }
                    }
                    var _valid0 = _errs12 === errors2;
                    valid1 = valid1 || _valid0;
                    const _errs14 = errors2;
                    if (data4 !== null) {
                      const err2 = { instancePath: instancePath + "/clientId", schemaPath: "#/properties/clientId/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
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
                      const err3 = { instancePath: instancePath + "/clientId", schemaPath: "#/properties/clientId/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                      if (vErrors === null) {
                        vErrors = [err3];
                      } else {
                        vErrors.push(err3);
                      }
                      errors2++;
                      validate45.errors = vErrors;
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
var schema56 = { "type": "object", "properties": { "error": { "type": "object", "properties": { "code": { "enum": ["NOT_FOUND", "METHOD_NOT_ALLOWED", "SESSION_REFUSED", "UNSUPPORTED_MEDIA_TYPE", "INVALID_REQUEST", "INVALID_CURSOR", "REQUEST_REPLAY_REFUSED", "SCOPE_REFUSED", "SESSION_CHANGED", "STALE_WRITER", "CONVERSATION_SELECTOR_REFUSED", "DEADLINE", "CANCELLED", "REQUEST_TOO_LARGE", "CONVERSATION_UNAVAILABLE", "MODEL_SELECTION_UNAVAILABLE", "MODEL_SETTINGS_UNAVAILABLE", "FEEDBACK_TARGET_REFUSED", "FEEDBACK_SOURCE_REFUSED", "FEEDBACK_REVISION_CHANGED", "FEEDBACK_REPLAY_REFUSED", "FEEDBACK_LIMIT", "FEEDBACK_WRITE_UNKNOWN"] } }, "required": ["code"], "additionalProperties": false } }, "required": ["error"], "additionalProperties": false };
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
                      if (!(data1 === "NOT_FOUND" || data1 === "METHOD_NOT_ALLOWED" || data1 === "SESSION_REFUSED" || data1 === "UNSUPPORTED_MEDIA_TYPE" || data1 === "INVALID_REQUEST" || data1 === "INVALID_CURSOR" || data1 === "REQUEST_REPLAY_REFUSED" || data1 === "SCOPE_REFUSED" || data1 === "SESSION_CHANGED" || data1 === "STALE_WRITER" || data1 === "CONVERSATION_SELECTOR_REFUSED" || data1 === "DEADLINE" || data1 === "CANCELLED" || data1 === "REQUEST_TOO_LARGE" || data1 === "CONVERSATION_UNAVAILABLE" || data1 === "MODEL_SELECTION_UNAVAILABLE" || data1 === "MODEL_SETTINGS_UNAVAILABLE" || data1 === "FEEDBACK_TARGET_REFUSED" || data1 === "FEEDBACK_SOURCE_REFUSED" || data1 === "FEEDBACK_REVISION_CHANGED" || data1 === "FEEDBACK_REPLAY_REFUSED" || data1 === "FEEDBACK_LIMIT" || data1 === "FEEDBACK_WRITE_UNKNOWN")) {
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
      if (!d || !Object.hasOwn(d, "value") || !d.enumerable || typeof d.value !== "string" && !(key === "clientId" && d.value === null)) fail2("INPUT_CONTEXT_INVALID");
      context[key] = d.value;
    }
    if (["tenantId", "actorId"].some((key) => !context[key] || context[key].length > 128) || ["conversationId", "runId"].some((key) => !uuid.test(context[key])) || context.clientId !== null && !uuid.test(context.clientId)) fail2("INPUT_CONTEXT_INVALID");
    return Object.freeze(context);
  } catch (error) {
    if (error instanceof ConversationResponseError) throw error;
    fail2("INPUT_CONTEXT_INVALID");
  }
}
function assertInputContext(receipt, context) {
  const b = receipt.run.binding;
  if (["tenantId", "actorId", "conversationId", "runId"].some((key) => b[key] !== context[key]) || (context.clientId === null ? receipt.run.scopes.length !== 1 || receipt.run.scopes[0].kind !== "private-user" || receipt.run.scopes[0].tenantId !== context.tenantId || receipt.run.scopes[0].resourceId !== context.actorId : !receipt.run.scopes.some((scope) => scope.kind === "client" && scope.tenantId === context.tenantId && scope.resourceId === context.clientId))) fail2("INPUT_CONTEXT_MISMATCH");
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
var conversationInputVersion = "1.3.0";
var conversationInputPath = "/api/conversations/input/admit";
var inputErrorStatuses = conversationApplicationMetadata.errorStatuses;
var conversationInputMetadata = freeze({
  packageVersion: "0.1.7",
  inputVersion: conversationInputVersion,
  schemaId: "urn:meri:conversation-input:1.3.0",
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
