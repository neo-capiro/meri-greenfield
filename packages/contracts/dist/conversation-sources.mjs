// Generated browser source boundary. No authority.
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

// sources-generated:./generated-validator.mjs
var validateRequest = validate30;
var pattern4 = new RegExp("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", "u");
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
      let missing0;
      if (data.schemaVersion === void 0 && (missing0 = "schemaVersion") || data.conversationId === void 0 && (missing0 = "conversationId") || data.runId === void 0 && (missing0 = "runId") || data.referenceId === void 0 && (missing0 = "referenceId")) {
        validate30.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "schemaVersion" || key0 === "conversationId" || key0 === "runId" || key0 === "referenceId")) {
            validate30.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.schemaVersion !== void 0) {
            const _errs2 = errors2;
            if ("meri.bill-text-source-read/1" !== data.schemaVersion) {
              validate30.errors = [{ instancePath: instancePath + "/schemaVersion", schemaPath: "#/properties/schemaVersion/const", keyword: "const", params: { allowedValue: "meri.bill-text-source-read/1" }, message: "must be equal to constant" }];
              return false;
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.conversationId !== void 0) {
              let data1 = data.conversationId;
              const _errs3 = errors2;
              if (errors2 === _errs3) {
                if (typeof data1 === "string") {
                  if (!pattern4.test(data1)) {
                    validate30.errors = [{ instancePath: instancePath + "/conversationId", schemaPath: "#/properties/conversationId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' }];
                    return false;
                  }
                } else {
                  validate30.errors = [{ instancePath: instancePath + "/conversationId", schemaPath: "#/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                  return false;
                }
              }
              var valid0 = _errs3 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.runId !== void 0) {
                let data2 = data.runId;
                const _errs5 = errors2;
                if (errors2 === _errs5) {
                  if (typeof data2 === "string") {
                    if (!pattern4.test(data2)) {
                      validate30.errors = [{ instancePath: instancePath + "/runId", schemaPath: "#/properties/runId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' }];
                      return false;
                    }
                  } else {
                    validate30.errors = [{ instancePath: instancePath + "/runId", schemaPath: "#/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
                  }
                }
                var valid0 = _errs5 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.referenceId !== void 0) {
                  let data3 = data.referenceId;
                  const _errs7 = errors2;
                  if (errors2 === _errs7) {
                    if (typeof data3 === "string") {
                      if (!pattern4.test(data3)) {
                        validate30.errors = [{ instancePath: instancePath + "/referenceId", schemaPath: "#/properties/referenceId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" }, message: 'must match pattern "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"' }];
                        return false;
                      }
                    } else {
                      validate30.errors = [{ instancePath: instancePath + "/referenceId", schemaPath: "#/properties/referenceId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                      return false;
                    }
                  }
                  var valid0 = _errs7 === errors2;
                } else {
                  var valid0 = true;
                }
              }
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
var validateResponse = validate31;
var schema35 = { "type": "object", "properties": { "schemaVersion": { "const": "meri.bill-text-source-read/1" }, "event": { "$ref": "#/$defs/NativeBillTextSourceEvent" }, "current": { "type": "object", "properties": { "text": { "type": "string", "maxLength": 9e3 }, "sourceModifiedAt": { "anyOf": [{ "type": "string", "format": "date-time" }, { "type": "null" }] }, "publishedAt": { "anyOf": [{ "type": "string", "format": "date-time" }, { "type": "null" }] }, "fetchedAt": { "type": "string", "format": "date-time" }, "coverage": { "type": "object", "additionalProperties": false, "properties": { "totalCharacters": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "pageComplete": { "const": true }, "contentComplete": { "type": "boolean" }, "paginationComplete": { "type": "boolean" }, "complete": { "type": "boolean" }, "truncated": { "type": "boolean" }, "nextCursor": { "anyOf": [{ "type": "string", "minLength": 1, "maxLength": 1024, "pattern": "^[A-Za-z0-9_-]+$" }, { "type": "null" }] }, "locator": { "type": "object", "additionalProperties": false, "properties": { "offset": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "endOffset": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 } }, "required": ["offset", "endOffset"] } }, "required": ["totalCharacters", "pageComplete", "contentComplete", "paginationComplete", "complete", "truncated", "nextCursor", "locator"] }, "sourceLocator": { "anyOf": [{ "type": "string", "maxLength": 4096 }, { "type": "null" }] }, "linkStatus": { "enum": ["available", "unsafe"] } }, "required": ["text", "sourceModifiedAt", "publishedAt", "fetchedAt", "coverage", "sourceLocator", "linkStatus"], "additionalProperties": false } }, "required": ["schemaVersion", "event", "current"], "additionalProperties": false };
var schema38 = { "type": "object", "properties": { "tenantId": { "type": "string", "minLength": 1, "maxLength": 128 }, "kind": { "type": "string", "enum": ["tenant", "client", "mailbox", "memory", "document", "private-user", "public"] }, "resourceId": { "type": "string", "minLength": 1, "maxLength": 256 }, "policyRevision": { "type": "string", "minLength": 1, "maxLength": 128 } }, "required": ["tenantId", "kind", "resourceId", "policyRevision"], "additionalProperties": false };
var schema39 = { "type": "object", "properties": { "schemaVersion": { "const": "meri.native-bill-text-source/1" }, "deliveryId": { "type": "string", "pattern": "^[-A-Za-z0-9_.:@/]{1,255}$" }, "operation": { "type": "object", "properties": { "id": { "const": "read_bill_text" }, "version": { "const": "0.2.0" } }, "required": ["id", "version"], "additionalProperties": false }, "requestSha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "argumentsSha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "resultSha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "executionSha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "policyRevision": { "type": "string", "minLength": 1, "maxLength": 255 }, "source": { "type": "object", "properties": { "authoritativeOwner": { "const": "federal_evidence_current" }, "billId": { "type": "string", "minLength": 1, "maxLength": 255 }, "versionCode": { "type": "string", "minLength": 1, "maxLength": 255 }, "revisionId": { "type": "string", "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$" }, "packageId": { "type": "string", "minLength": 1, "maxLength": 255 }, "provider": { "type": "string", "minLength": 1, "maxLength": 255 }, "lineageKey": { "type": "string", "minLength": 1, "maxLength": 4096 }, "versionHash": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "textHash": { "type": "string", "pattern": "^[a-f0-9]{64}$" } }, "required": ["authoritativeOwner", "billId", "versionCode", "revisionId", "packageId", "provider", "lineageKey", "versionHash", "textHash"], "additionalProperties": false }, "page": { "type": "object", "properties": { "offset": { "type": "integer", "minimum": 0, "maximum": 3e7 }, "endOffset": { "type": "integer", "minimum": 0, "maximum": 3e7 }, "totalCharacters": { "type": "integer", "minimum": 0, "maximum": 3e7 }, "textSha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }, "pageComplete": { "const": true }, "contentComplete": { "type": "boolean" }, "paginationComplete": { "type": "boolean" }, "truncated": { "type": "boolean" } }, "required": ["offset", "endOffset", "totalCharacters", "textSha256", "pageComplete", "contentComplete", "paginationComplete", "truncated"], "additionalProperties": false } }, "required": ["schemaVersion", "deliveryId", "operation", "requestSha256", "argumentsSha256", "resultSha256", "executionSha256", "policyRevision", "source", "page"], "additionalProperties": false };
var formats0 = /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
var formats10 = require_formats().fullFormats["date-time"];
var func1 = require_ucs2length().default;
var func0 = require_equal().default;
var func12 = Object.prototype.hasOwnProperty;
var pattern7 = new RegExp("Z$", "u");
var pattern8 = new RegExp("^[-A-Za-z0-9_.:@/]{1,255}$", "u");
var pattern9 = new RegExp("^[a-f0-9]{64}$", "u");
var pattern13 = new RegExp("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$", "u");
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
      if (data.contractVersion === void 0 && (missing0 = "contractVersion") || data.eventId === void 0 && (missing0 = "eventId") || data.binding === void 0 && (missing0 = "binding") || data.sequence === void 0 && (missing0 = "sequence") || data.createdAt === void 0 && (missing0 = "createdAt") || data.scopes === void 0 && (missing0 = "scopes") || data.type === void 0 && (missing0 = "type") || data.data === void 0 && (missing0 = "data")) {
        validate24.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "contractVersion" || key0 === "eventId" || key0 === "binding" || key0 === "sequence" || key0 === "createdAt" || key0 === "scopes" || key0 === "type" || key0 === "data")) {
            validate24.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.contractVersion !== void 0) {
            const _errs2 = errors2;
            if ("0.1.0" !== data.contractVersion) {
              validate24.errors = [{ instancePath: instancePath + "/contractVersion", schemaPath: "#/properties/contractVersion/const", keyword: "const", params: { allowedValue: "0.1.0" }, message: "must be equal to constant" }];
              return false;
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.eventId !== void 0) {
              let data1 = data.eventId;
              const _errs3 = errors2;
              if (errors2 === _errs3) {
                if (errors2 === _errs3) {
                  if (typeof data1 === "string") {
                    if (!formats0.test(data1)) {
                      validate24.errors = [{ instancePath: instancePath + "/eventId", schemaPath: "#/properties/eventId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                      return false;
                    }
                  } else {
                    validate24.errors = [{ instancePath: instancePath + "/eventId", schemaPath: "#/properties/eventId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                      validate24.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                      return false;
                    } else {
                      const _errs8 = errors2;
                      for (const key1 in data2) {
                        if (!(key1 === "tenantId" || key1 === "actorId" || key1 === "conversationId" || key1 === "runId" || key1 === "attemptId" || key1 === "workerId" || key1 === "writerFence")) {
                          validate24.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
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
                                validate24.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                return false;
                              } else {
                                if (func1(data3) < 1) {
                                  validate24.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                  return false;
                                }
                              }
                            } else {
                              validate24.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                  validate24.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                  return false;
                                } else {
                                  if (func1(data4) < 1) {
                                    validate24.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                    return false;
                                  }
                                }
                              } else {
                                validate24.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                      validate24.errors = [{ instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                      return false;
                                    }
                                  } else {
                                    validate24.errors = [{ instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                        validate24.errors = [{ instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                        return false;
                                      }
                                    } else {
                                      validate24.errors = [{ instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                          validate24.errors = [{ instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                          return false;
                                        }
                                      } else {
                                        validate24.errors = [{ instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                            validate24.errors = [{ instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                            return false;
                                          }
                                        } else {
                                          validate24.errors = [{ instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                        validate24.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                        return false;
                                      }
                                      if (errors2 === _errs21) {
                                        if (typeof data9 == "number" && isFinite(data9)) {
                                          if (data9 > 9007199254740991 || isNaN(data9)) {
                                            validate24.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                            return false;
                                          } else {
                                            if (data9 < 1 || isNaN(data9)) {
                                              validate24.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
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
                    validate24.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                    return false;
                  }
                }
                var valid0 = _errs5 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.sequence !== void 0) {
                  let data10 = data.sequence;
                  const _errs23 = errors2;
                  if (!(typeof data10 == "number" && (!(data10 % 1) && !isNaN(data10)) && isFinite(data10))) {
                    validate24.errors = [{ instancePath: instancePath + "/sequence", schemaPath: "#/properties/sequence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                    return false;
                  }
                  if (errors2 === _errs23) {
                    if (typeof data10 == "number" && isFinite(data10)) {
                      if (data10 > 9007199254740991 || isNaN(data10)) {
                        validate24.errors = [{ instancePath: instancePath + "/sequence", schemaPath: "#/properties/sequence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                        return false;
                      } else {
                        if (data10 < 1 || isNaN(data10)) {
                          validate24.errors = [{ instancePath: instancePath + "/sequence", schemaPath: "#/properties/sequence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                          return false;
                        }
                      }
                    }
                  }
                  var valid0 = _errs23 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.createdAt !== void 0) {
                    let data11 = data.createdAt;
                    const _errs25 = errors2;
                    if (errors2 === _errs25) {
                      if (errors2 === _errs25) {
                        if (typeof data11 === "string") {
                          if (!pattern7.test(data11)) {
                            validate24.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                            return false;
                          } else {
                            if (!formats10.validate(data11)) {
                              validate24.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                              return false;
                            }
                          }
                        } else {
                          validate24.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                          return false;
                        }
                      }
                    }
                    var valid0 = _errs25 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.scopes !== void 0) {
                      let data12 = data.scopes;
                      const _errs27 = errors2;
                      if (errors2 === _errs27) {
                        if (Array.isArray(data12)) {
                          if (data12.length < 1) {
                            validate24.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                            return false;
                          } else {
                            var valid3 = true;
                            const len0 = data12.length;
                            for (let i0 = 0; i0 < len0; i0++) {
                              let data13 = data12[i0];
                              const _errs29 = errors2;
                              const _errs30 = errors2;
                              if (errors2 === _errs30) {
                                if (data13 && typeof data13 == "object" && !Array.isArray(data13)) {
                                  let missing2;
                                  if (data13.tenantId === void 0 && (missing2 = "tenantId") || data13.kind === void 0 && (missing2 = "kind") || data13.resourceId === void 0 && (missing2 = "resourceId") || data13.policyRevision === void 0 && (missing2 = "policyRevision")) {
                                    validate24.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" }];
                                    return false;
                                  } else {
                                    const _errs32 = errors2;
                                    for (const key2 in data13) {
                                      if (!(key2 === "tenantId" || key2 === "kind" || key2 === "resourceId" || key2 === "policyRevision")) {
                                        validate24.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" }];
                                        return false;
                                        break;
                                      }
                                    }
                                    if (_errs32 === errors2) {
                                      if (data13.tenantId !== void 0) {
                                        let data14 = data13.tenantId;
                                        const _errs33 = errors2;
                                        if (errors2 === _errs33) {
                                          if (typeof data14 === "string") {
                                            if (func1(data14) > 128) {
                                              validate24.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                              return false;
                                            } else {
                                              if (func1(data14) < 1) {
                                                validate24.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                return false;
                                              }
                                            }
                                          } else {
                                            validate24.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                            return false;
                                          }
                                        }
                                        var valid5 = _errs33 === errors2;
                                      } else {
                                        var valid5 = true;
                                      }
                                      if (valid5) {
                                        if (data13.kind !== void 0) {
                                          let data15 = data13.kind;
                                          const _errs35 = errors2;
                                          if (typeof data15 !== "string") {
                                            validate24.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                            return false;
                                          }
                                          if (!(data15 === "tenant" || data15 === "client" || data15 === "mailbox" || data15 === "memory" || data15 === "document" || data15 === "private-user" || data15 === "public")) {
                                            validate24.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/enum", keyword: "enum", params: { allowedValues: schema38.properties.kind.enum }, message: "must be equal to one of the allowed values" }];
                                            return false;
                                          }
                                          var valid5 = _errs35 === errors2;
                                        } else {
                                          var valid5 = true;
                                        }
                                        if (valid5) {
                                          if (data13.resourceId !== void 0) {
                                            let data16 = data13.resourceId;
                                            const _errs37 = errors2;
                                            if (errors2 === _errs37) {
                                              if (typeof data16 === "string") {
                                                if (func1(data16) > 256) {
                                                  validate24.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" }];
                                                  return false;
                                                } else {
                                                  if (func1(data16) < 1) {
                                                    validate24.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                    return false;
                                                  }
                                                }
                                              } else {
                                                validate24.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                return false;
                                              }
                                            }
                                            var valid5 = _errs37 === errors2;
                                          } else {
                                            var valid5 = true;
                                          }
                                          if (valid5) {
                                            if (data13.policyRevision !== void 0) {
                                              let data17 = data13.policyRevision;
                                              const _errs39 = errors2;
                                              if (errors2 === _errs39) {
                                                if (typeof data17 === "string") {
                                                  if (func1(data17) > 128) {
                                                    validate24.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                                    return false;
                                                  } else {
                                                    if (func1(data17) < 1) {
                                                      validate24.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                      return false;
                                                    }
                                                  }
                                                } else {
                                                  validate24.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                  return false;
                                                }
                                              }
                                              var valid5 = _errs39 === errors2;
                                            } else {
                                              var valid5 = true;
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }
                                } else {
                                  validate24.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                  return false;
                                }
                              }
                              var valid3 = _errs29 === errors2;
                              if (!valid3) {
                                break;
                              }
                            }
                            if (valid3) {
                              let i1 = data12.length;
                              let j0;
                              if (i1 > 1) {
                                outer0: for (; i1--; ) {
                                  for (j0 = i1; j0--; ) {
                                    if (func0(data12[i1], data12[j0])) {
                                      validate24.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/uniqueItems", keyword: "uniqueItems", params: { i: i1, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)" }];
                                      return false;
                                      break outer0;
                                    }
                                  }
                                }
                              }
                            }
                          }
                        } else {
                          validate24.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                          return false;
                        }
                      }
                      var valid0 = _errs27 === errors2;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.type !== void 0) {
                        const _errs41 = errors2;
                        if ("source.native-bill-text" !== data.type) {
                          validate24.errors = [{ instancePath: instancePath + "/type", schemaPath: "#/properties/type/const", keyword: "const", params: { allowedValue: "source.native-bill-text" }, message: "must be equal to constant" }];
                          return false;
                        }
                        var valid0 = _errs41 === errors2;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.data !== void 0) {
                          let data19 = data.data;
                          const _errs42 = errors2;
                          const _errs43 = errors2;
                          if (errors2 === _errs43) {
                            if (data19 && typeof data19 == "object" && !Array.isArray(data19)) {
                              let missing3;
                              if (data19.schemaVersion === void 0 && (missing3 = "schemaVersion") || data19.deliveryId === void 0 && (missing3 = "deliveryId") || data19.operation === void 0 && (missing3 = "operation") || data19.requestSha256 === void 0 && (missing3 = "requestSha256") || data19.argumentsSha256 === void 0 && (missing3 = "argumentsSha256") || data19.resultSha256 === void 0 && (missing3 = "resultSha256") || data19.executionSha256 === void 0 && (missing3 = "executionSha256") || data19.policyRevision === void 0 && (missing3 = "policyRevision") || data19.source === void 0 && (missing3 = "source") || data19.page === void 0 && (missing3 = "page")) {
                                validate24.errors = [{ instancePath: instancePath + "/data", schemaPath: "#/$defs/NativeBillTextSource/required", keyword: "required", params: { missingProperty: missing3 }, message: "must have required property '" + missing3 + "'" }];
                                return false;
                              } else {
                                const _errs45 = errors2;
                                for (const key3 in data19) {
                                  if (!func12.call(schema39.properties, key3)) {
                                    validate24.errors = [{ instancePath: instancePath + "/data", schemaPath: "#/$defs/NativeBillTextSource/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" }];
                                    return false;
                                    break;
                                  }
                                }
                                if (_errs45 === errors2) {
                                  if (data19.schemaVersion !== void 0) {
                                    const _errs46 = errors2;
                                    if ("meri.native-bill-text-source/1" !== data19.schemaVersion) {
                                      validate24.errors = [{ instancePath: instancePath + "/data/schemaVersion", schemaPath: "#/$defs/NativeBillTextSource/properties/schemaVersion/const", keyword: "const", params: { allowedValue: "meri.native-bill-text-source/1" }, message: "must be equal to constant" }];
                                      return false;
                                    }
                                    var valid8 = _errs46 === errors2;
                                  } else {
                                    var valid8 = true;
                                  }
                                  if (valid8) {
                                    if (data19.deliveryId !== void 0) {
                                      let data21 = data19.deliveryId;
                                      const _errs47 = errors2;
                                      if (errors2 === _errs47) {
                                        if (typeof data21 === "string") {
                                          if (!pattern8.test(data21)) {
                                            validate24.errors = [{ instancePath: instancePath + "/data/deliveryId", schemaPath: "#/$defs/NativeBillTextSource/properties/deliveryId/pattern", keyword: "pattern", params: { pattern: "^[-A-Za-z0-9_.:@/]{1,255}$" }, message: 'must match pattern "^[-A-Za-z0-9_.:@/]{1,255}$"' }];
                                            return false;
                                          }
                                        } else {
                                          validate24.errors = [{ instancePath: instancePath + "/data/deliveryId", schemaPath: "#/$defs/NativeBillTextSource/properties/deliveryId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                          return false;
                                        }
                                      }
                                      var valid8 = _errs47 === errors2;
                                    } else {
                                      var valid8 = true;
                                    }
                                    if (valid8) {
                                      if (data19.operation !== void 0) {
                                        let data22 = data19.operation;
                                        const _errs49 = errors2;
                                        if (errors2 === _errs49) {
                                          if (data22 && typeof data22 == "object" && !Array.isArray(data22)) {
                                            let missing4;
                                            if (data22.id === void 0 && (missing4 = "id") || data22.version === void 0 && (missing4 = "version")) {
                                              validate24.errors = [{ instancePath: instancePath + "/data/operation", schemaPath: "#/$defs/NativeBillTextSource/properties/operation/required", keyword: "required", params: { missingProperty: missing4 }, message: "must have required property '" + missing4 + "'" }];
                                              return false;
                                            } else {
                                              const _errs51 = errors2;
                                              for (const key4 in data22) {
                                                if (!(key4 === "id" || key4 === "version")) {
                                                  validate24.errors = [{ instancePath: instancePath + "/data/operation", schemaPath: "#/$defs/NativeBillTextSource/properties/operation/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key4 }, message: "must NOT have additional properties" }];
                                                  return false;
                                                  break;
                                                }
                                              }
                                              if (_errs51 === errors2) {
                                                if (data22.id !== void 0) {
                                                  const _errs52 = errors2;
                                                  if ("read_bill_text" !== data22.id) {
                                                    validate24.errors = [{ instancePath: instancePath + "/data/operation/id", schemaPath: "#/$defs/NativeBillTextSource/properties/operation/properties/id/const", keyword: "const", params: { allowedValue: "read_bill_text" }, message: "must be equal to constant" }];
                                                    return false;
                                                  }
                                                  var valid9 = _errs52 === errors2;
                                                } else {
                                                  var valid9 = true;
                                                }
                                                if (valid9) {
                                                  if (data22.version !== void 0) {
                                                    const _errs53 = errors2;
                                                    if ("0.2.0" !== data22.version) {
                                                      validate24.errors = [{ instancePath: instancePath + "/data/operation/version", schemaPath: "#/$defs/NativeBillTextSource/properties/operation/properties/version/const", keyword: "const", params: { allowedValue: "0.2.0" }, message: "must be equal to constant" }];
                                                      return false;
                                                    }
                                                    var valid9 = _errs53 === errors2;
                                                  } else {
                                                    var valid9 = true;
                                                  }
                                                }
                                              }
                                            }
                                          } else {
                                            validate24.errors = [{ instancePath: instancePath + "/data/operation", schemaPath: "#/$defs/NativeBillTextSource/properties/operation/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                            return false;
                                          }
                                        }
                                        var valid8 = _errs49 === errors2;
                                      } else {
                                        var valid8 = true;
                                      }
                                      if (valid8) {
                                        if (data19.requestSha256 !== void 0) {
                                          let data25 = data19.requestSha256;
                                          const _errs54 = errors2;
                                          if (errors2 === _errs54) {
                                            if (typeof data25 === "string") {
                                              if (!pattern9.test(data25)) {
                                                validate24.errors = [{ instancePath: instancePath + "/data/requestSha256", schemaPath: "#/$defs/NativeBillTextSource/properties/requestSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                                return false;
                                              }
                                            } else {
                                              validate24.errors = [{ instancePath: instancePath + "/data/requestSha256", schemaPath: "#/$defs/NativeBillTextSource/properties/requestSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                              return false;
                                            }
                                          }
                                          var valid8 = _errs54 === errors2;
                                        } else {
                                          var valid8 = true;
                                        }
                                        if (valid8) {
                                          if (data19.argumentsSha256 !== void 0) {
                                            let data26 = data19.argumentsSha256;
                                            const _errs56 = errors2;
                                            if (errors2 === _errs56) {
                                              if (typeof data26 === "string") {
                                                if (!pattern9.test(data26)) {
                                                  validate24.errors = [{ instancePath: instancePath + "/data/argumentsSha256", schemaPath: "#/$defs/NativeBillTextSource/properties/argumentsSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                                  return false;
                                                }
                                              } else {
                                                validate24.errors = [{ instancePath: instancePath + "/data/argumentsSha256", schemaPath: "#/$defs/NativeBillTextSource/properties/argumentsSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                return false;
                                              }
                                            }
                                            var valid8 = _errs56 === errors2;
                                          } else {
                                            var valid8 = true;
                                          }
                                          if (valid8) {
                                            if (data19.resultSha256 !== void 0) {
                                              let data27 = data19.resultSha256;
                                              const _errs58 = errors2;
                                              if (errors2 === _errs58) {
                                                if (typeof data27 === "string") {
                                                  if (!pattern9.test(data27)) {
                                                    validate24.errors = [{ instancePath: instancePath + "/data/resultSha256", schemaPath: "#/$defs/NativeBillTextSource/properties/resultSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                                    return false;
                                                  }
                                                } else {
                                                  validate24.errors = [{ instancePath: instancePath + "/data/resultSha256", schemaPath: "#/$defs/NativeBillTextSource/properties/resultSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                  return false;
                                                }
                                              }
                                              var valid8 = _errs58 === errors2;
                                            } else {
                                              var valid8 = true;
                                            }
                                            if (valid8) {
                                              if (data19.executionSha256 !== void 0) {
                                                let data28 = data19.executionSha256;
                                                const _errs60 = errors2;
                                                if (errors2 === _errs60) {
                                                  if (typeof data28 === "string") {
                                                    if (!pattern9.test(data28)) {
                                                      validate24.errors = [{ instancePath: instancePath + "/data/executionSha256", schemaPath: "#/$defs/NativeBillTextSource/properties/executionSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                                      return false;
                                                    }
                                                  } else {
                                                    validate24.errors = [{ instancePath: instancePath + "/data/executionSha256", schemaPath: "#/$defs/NativeBillTextSource/properties/executionSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                    return false;
                                                  }
                                                }
                                                var valid8 = _errs60 === errors2;
                                              } else {
                                                var valid8 = true;
                                              }
                                              if (valid8) {
                                                if (data19.policyRevision !== void 0) {
                                                  let data29 = data19.policyRevision;
                                                  const _errs62 = errors2;
                                                  if (errors2 === _errs62) {
                                                    if (typeof data29 === "string") {
                                                      if (func1(data29) > 255) {
                                                        validate24.errors = [{ instancePath: instancePath + "/data/policyRevision", schemaPath: "#/$defs/NativeBillTextSource/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 255 }, message: "must NOT have more than 255 characters" }];
                                                        return false;
                                                      } else {
                                                        if (func1(data29) < 1) {
                                                          validate24.errors = [{ instancePath: instancePath + "/data/policyRevision", schemaPath: "#/$defs/NativeBillTextSource/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                          return false;
                                                        }
                                                      }
                                                    } else {
                                                      validate24.errors = [{ instancePath: instancePath + "/data/policyRevision", schemaPath: "#/$defs/NativeBillTextSource/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                      return false;
                                                    }
                                                  }
                                                  var valid8 = _errs62 === errors2;
                                                } else {
                                                  var valid8 = true;
                                                }
                                                if (valid8) {
                                                  if (data19.source !== void 0) {
                                                    let data30 = data19.source;
                                                    const _errs64 = errors2;
                                                    if (errors2 === _errs64) {
                                                      if (data30 && typeof data30 == "object" && !Array.isArray(data30)) {
                                                        let missing5;
                                                        if (data30.authoritativeOwner === void 0 && (missing5 = "authoritativeOwner") || data30.billId === void 0 && (missing5 = "billId") || data30.versionCode === void 0 && (missing5 = "versionCode") || data30.revisionId === void 0 && (missing5 = "revisionId") || data30.packageId === void 0 && (missing5 = "packageId") || data30.provider === void 0 && (missing5 = "provider") || data30.lineageKey === void 0 && (missing5 = "lineageKey") || data30.versionHash === void 0 && (missing5 = "versionHash") || data30.textHash === void 0 && (missing5 = "textHash")) {
                                                          validate24.errors = [{ instancePath: instancePath + "/data/source", schemaPath: "#/$defs/NativeBillTextSource/properties/source/required", keyword: "required", params: { missingProperty: missing5 }, message: "must have required property '" + missing5 + "'" }];
                                                          return false;
                                                        } else {
                                                          const _errs66 = errors2;
                                                          for (const key5 in data30) {
                                                            if (!func12.call(schema39.properties.source.properties, key5)) {
                                                              validate24.errors = [{ instancePath: instancePath + "/data/source", schemaPath: "#/$defs/NativeBillTextSource/properties/source/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key5 }, message: "must NOT have additional properties" }];
                                                              return false;
                                                              break;
                                                            }
                                                          }
                                                          if (_errs66 === errors2) {
                                                            if (data30.authoritativeOwner !== void 0) {
                                                              const _errs67 = errors2;
                                                              if ("federal_evidence_current" !== data30.authoritativeOwner) {
                                                                validate24.errors = [{ instancePath: instancePath + "/data/source/authoritativeOwner", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/authoritativeOwner/const", keyword: "const", params: { allowedValue: "federal_evidence_current" }, message: "must be equal to constant" }];
                                                                return false;
                                                              }
                                                              var valid10 = _errs67 === errors2;
                                                            } else {
                                                              var valid10 = true;
                                                            }
                                                            if (valid10) {
                                                              if (data30.billId !== void 0) {
                                                                let data32 = data30.billId;
                                                                const _errs68 = errors2;
                                                                if (errors2 === _errs68) {
                                                                  if (typeof data32 === "string") {
                                                                    if (func1(data32) > 255) {
                                                                      validate24.errors = [{ instancePath: instancePath + "/data/source/billId", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/billId/maxLength", keyword: "maxLength", params: { limit: 255 }, message: "must NOT have more than 255 characters" }];
                                                                      return false;
                                                                    } else {
                                                                      if (func1(data32) < 1) {
                                                                        validate24.errors = [{ instancePath: instancePath + "/data/source/billId", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/billId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                                        return false;
                                                                      }
                                                                    }
                                                                  } else {
                                                                    validate24.errors = [{ instancePath: instancePath + "/data/source/billId", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/billId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                    return false;
                                                                  }
                                                                }
                                                                var valid10 = _errs68 === errors2;
                                                              } else {
                                                                var valid10 = true;
                                                              }
                                                              if (valid10) {
                                                                if (data30.versionCode !== void 0) {
                                                                  let data33 = data30.versionCode;
                                                                  const _errs70 = errors2;
                                                                  if (errors2 === _errs70) {
                                                                    if (typeof data33 === "string") {
                                                                      if (func1(data33) > 255) {
                                                                        validate24.errors = [{ instancePath: instancePath + "/data/source/versionCode", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/versionCode/maxLength", keyword: "maxLength", params: { limit: 255 }, message: "must NOT have more than 255 characters" }];
                                                                        return false;
                                                                      } else {
                                                                        if (func1(data33) < 1) {
                                                                          validate24.errors = [{ instancePath: instancePath + "/data/source/versionCode", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/versionCode/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                                          return false;
                                                                        }
                                                                      }
                                                                    } else {
                                                                      validate24.errors = [{ instancePath: instancePath + "/data/source/versionCode", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/versionCode/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                      return false;
                                                                    }
                                                                  }
                                                                  var valid10 = _errs70 === errors2;
                                                                } else {
                                                                  var valid10 = true;
                                                                }
                                                                if (valid10) {
                                                                  if (data30.revisionId !== void 0) {
                                                                    let data34 = data30.revisionId;
                                                                    const _errs72 = errors2;
                                                                    if (errors2 === _errs72) {
                                                                      if (typeof data34 === "string") {
                                                                        if (!pattern13.test(data34)) {
                                                                          validate24.errors = [{ instancePath: instancePath + "/data/source/revisionId", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/revisionId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$" }, message: 'must match pattern "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"' }];
                                                                          return false;
                                                                        }
                                                                      } else {
                                                                        validate24.errors = [{ instancePath: instancePath + "/data/source/revisionId", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/revisionId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                        return false;
                                                                      }
                                                                    }
                                                                    var valid10 = _errs72 === errors2;
                                                                  } else {
                                                                    var valid10 = true;
                                                                  }
                                                                  if (valid10) {
                                                                    if (data30.packageId !== void 0) {
                                                                      let data35 = data30.packageId;
                                                                      const _errs74 = errors2;
                                                                      if (errors2 === _errs74) {
                                                                        if (typeof data35 === "string") {
                                                                          if (func1(data35) > 255) {
                                                                            validate24.errors = [{ instancePath: instancePath + "/data/source/packageId", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/packageId/maxLength", keyword: "maxLength", params: { limit: 255 }, message: "must NOT have more than 255 characters" }];
                                                                            return false;
                                                                          } else {
                                                                            if (func1(data35) < 1) {
                                                                              validate24.errors = [{ instancePath: instancePath + "/data/source/packageId", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/packageId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                                              return false;
                                                                            }
                                                                          }
                                                                        } else {
                                                                          validate24.errors = [{ instancePath: instancePath + "/data/source/packageId", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/packageId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                          return false;
                                                                        }
                                                                      }
                                                                      var valid10 = _errs74 === errors2;
                                                                    } else {
                                                                      var valid10 = true;
                                                                    }
                                                                    if (valid10) {
                                                                      if (data30.provider !== void 0) {
                                                                        let data36 = data30.provider;
                                                                        const _errs76 = errors2;
                                                                        if (errors2 === _errs76) {
                                                                          if (typeof data36 === "string") {
                                                                            if (func1(data36) > 255) {
                                                                              validate24.errors = [{ instancePath: instancePath + "/data/source/provider", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/provider/maxLength", keyword: "maxLength", params: { limit: 255 }, message: "must NOT have more than 255 characters" }];
                                                                              return false;
                                                                            } else {
                                                                              if (func1(data36) < 1) {
                                                                                validate24.errors = [{ instancePath: instancePath + "/data/source/provider", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/provider/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                                                return false;
                                                                              }
                                                                            }
                                                                          } else {
                                                                            validate24.errors = [{ instancePath: instancePath + "/data/source/provider", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/provider/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                            return false;
                                                                          }
                                                                        }
                                                                        var valid10 = _errs76 === errors2;
                                                                      } else {
                                                                        var valid10 = true;
                                                                      }
                                                                      if (valid10) {
                                                                        if (data30.lineageKey !== void 0) {
                                                                          let data37 = data30.lineageKey;
                                                                          const _errs78 = errors2;
                                                                          if (errors2 === _errs78) {
                                                                            if (typeof data37 === "string") {
                                                                              if (func1(data37) > 4096) {
                                                                                validate24.errors = [{ instancePath: instancePath + "/data/source/lineageKey", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/lineageKey/maxLength", keyword: "maxLength", params: { limit: 4096 }, message: "must NOT have more than 4096 characters" }];
                                                                                return false;
                                                                              } else {
                                                                                if (func1(data37) < 1) {
                                                                                  validate24.errors = [{ instancePath: instancePath + "/data/source/lineageKey", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/lineageKey/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                                                  return false;
                                                                                }
                                                                              }
                                                                            } else {
                                                                              validate24.errors = [{ instancePath: instancePath + "/data/source/lineageKey", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/lineageKey/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                              return false;
                                                                            }
                                                                          }
                                                                          var valid10 = _errs78 === errors2;
                                                                        } else {
                                                                          var valid10 = true;
                                                                        }
                                                                        if (valid10) {
                                                                          if (data30.versionHash !== void 0) {
                                                                            let data38 = data30.versionHash;
                                                                            const _errs80 = errors2;
                                                                            if (errors2 === _errs80) {
                                                                              if (typeof data38 === "string") {
                                                                                if (!pattern9.test(data38)) {
                                                                                  validate24.errors = [{ instancePath: instancePath + "/data/source/versionHash", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/versionHash/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                                                                  return false;
                                                                                }
                                                                              } else {
                                                                                validate24.errors = [{ instancePath: instancePath + "/data/source/versionHash", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/versionHash/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                                return false;
                                                                              }
                                                                            }
                                                                            var valid10 = _errs80 === errors2;
                                                                          } else {
                                                                            var valid10 = true;
                                                                          }
                                                                          if (valid10) {
                                                                            if (data30.textHash !== void 0) {
                                                                              let data39 = data30.textHash;
                                                                              const _errs82 = errors2;
                                                                              if (errors2 === _errs82) {
                                                                                if (typeof data39 === "string") {
                                                                                  if (!pattern9.test(data39)) {
                                                                                    validate24.errors = [{ instancePath: instancePath + "/data/source/textHash", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/textHash/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                                                                    return false;
                                                                                  }
                                                                                } else {
                                                                                  validate24.errors = [{ instancePath: instancePath + "/data/source/textHash", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/textHash/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                                  return false;
                                                                                }
                                                                              }
                                                                              var valid10 = _errs82 === errors2;
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
                                                        validate24.errors = [{ instancePath: instancePath + "/data/source", schemaPath: "#/$defs/NativeBillTextSource/properties/source/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                        return false;
                                                      }
                                                    }
                                                    var valid8 = _errs64 === errors2;
                                                  } else {
                                                    var valid8 = true;
                                                  }
                                                  if (valid8) {
                                                    if (data19.page !== void 0) {
                                                      let data40 = data19.page;
                                                      const _errs84 = errors2;
                                                      if (errors2 === _errs84) {
                                                        if (data40 && typeof data40 == "object" && !Array.isArray(data40)) {
                                                          let missing6;
                                                          if (data40.offset === void 0 && (missing6 = "offset") || data40.endOffset === void 0 && (missing6 = "endOffset") || data40.totalCharacters === void 0 && (missing6 = "totalCharacters") || data40.textSha256 === void 0 && (missing6 = "textSha256") || data40.pageComplete === void 0 && (missing6 = "pageComplete") || data40.contentComplete === void 0 && (missing6 = "contentComplete") || data40.paginationComplete === void 0 && (missing6 = "paginationComplete") || data40.truncated === void 0 && (missing6 = "truncated")) {
                                                            validate24.errors = [{ instancePath: instancePath + "/data/page", schemaPath: "#/$defs/NativeBillTextSource/properties/page/required", keyword: "required", params: { missingProperty: missing6 }, message: "must have required property '" + missing6 + "'" }];
                                                            return false;
                                                          } else {
                                                            const _errs86 = errors2;
                                                            for (const key6 in data40) {
                                                              if (!(key6 === "offset" || key6 === "endOffset" || key6 === "totalCharacters" || key6 === "textSha256" || key6 === "pageComplete" || key6 === "contentComplete" || key6 === "paginationComplete" || key6 === "truncated")) {
                                                                validate24.errors = [{ instancePath: instancePath + "/data/page", schemaPath: "#/$defs/NativeBillTextSource/properties/page/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key6 }, message: "must NOT have additional properties" }];
                                                                return false;
                                                                break;
                                                              }
                                                            }
                                                            if (_errs86 === errors2) {
                                                              if (data40.offset !== void 0) {
                                                                let data41 = data40.offset;
                                                                const _errs87 = errors2;
                                                                if (!(typeof data41 == "number" && (!(data41 % 1) && !isNaN(data41)) && isFinite(data41))) {
                                                                  validate24.errors = [{ instancePath: instancePath + "/data/page/offset", schemaPath: "#/$defs/NativeBillTextSource/properties/page/properties/offset/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                  return false;
                                                                }
                                                                if (errors2 === _errs87) {
                                                                  if (typeof data41 == "number" && isFinite(data41)) {
                                                                    if (data41 > 3e7 || isNaN(data41)) {
                                                                      validate24.errors = [{ instancePath: instancePath + "/data/page/offset", schemaPath: "#/$defs/NativeBillTextSource/properties/page/properties/offset/maximum", keyword: "maximum", params: { comparison: "<=", limit: 3e7 }, message: "must be <= 30000000" }];
                                                                      return false;
                                                                    } else {
                                                                      if (data41 < 0 || isNaN(data41)) {
                                                                        validate24.errors = [{ instancePath: instancePath + "/data/page/offset", schemaPath: "#/$defs/NativeBillTextSource/properties/page/properties/offset/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                        return false;
                                                                      }
                                                                    }
                                                                  }
                                                                }
                                                                var valid11 = _errs87 === errors2;
                                                              } else {
                                                                var valid11 = true;
                                                              }
                                                              if (valid11) {
                                                                if (data40.endOffset !== void 0) {
                                                                  let data42 = data40.endOffset;
                                                                  const _errs89 = errors2;
                                                                  if (!(typeof data42 == "number" && (!(data42 % 1) && !isNaN(data42)) && isFinite(data42))) {
                                                                    validate24.errors = [{ instancePath: instancePath + "/data/page/endOffset", schemaPath: "#/$defs/NativeBillTextSource/properties/page/properties/endOffset/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                    return false;
                                                                  }
                                                                  if (errors2 === _errs89) {
                                                                    if (typeof data42 == "number" && isFinite(data42)) {
                                                                      if (data42 > 3e7 || isNaN(data42)) {
                                                                        validate24.errors = [{ instancePath: instancePath + "/data/page/endOffset", schemaPath: "#/$defs/NativeBillTextSource/properties/page/properties/endOffset/maximum", keyword: "maximum", params: { comparison: "<=", limit: 3e7 }, message: "must be <= 30000000" }];
                                                                        return false;
                                                                      } else {
                                                                        if (data42 < 0 || isNaN(data42)) {
                                                                          validate24.errors = [{ instancePath: instancePath + "/data/page/endOffset", schemaPath: "#/$defs/NativeBillTextSource/properties/page/properties/endOffset/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                          return false;
                                                                        }
                                                                      }
                                                                    }
                                                                  }
                                                                  var valid11 = _errs89 === errors2;
                                                                } else {
                                                                  var valid11 = true;
                                                                }
                                                                if (valid11) {
                                                                  if (data40.totalCharacters !== void 0) {
                                                                    let data43 = data40.totalCharacters;
                                                                    const _errs91 = errors2;
                                                                    if (!(typeof data43 == "number" && (!(data43 % 1) && !isNaN(data43)) && isFinite(data43))) {
                                                                      validate24.errors = [{ instancePath: instancePath + "/data/page/totalCharacters", schemaPath: "#/$defs/NativeBillTextSource/properties/page/properties/totalCharacters/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                      return false;
                                                                    }
                                                                    if (errors2 === _errs91) {
                                                                      if (typeof data43 == "number" && isFinite(data43)) {
                                                                        if (data43 > 3e7 || isNaN(data43)) {
                                                                          validate24.errors = [{ instancePath: instancePath + "/data/page/totalCharacters", schemaPath: "#/$defs/NativeBillTextSource/properties/page/properties/totalCharacters/maximum", keyword: "maximum", params: { comparison: "<=", limit: 3e7 }, message: "must be <= 30000000" }];
                                                                          return false;
                                                                        } else {
                                                                          if (data43 < 0 || isNaN(data43)) {
                                                                            validate24.errors = [{ instancePath: instancePath + "/data/page/totalCharacters", schemaPath: "#/$defs/NativeBillTextSource/properties/page/properties/totalCharacters/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                            return false;
                                                                          }
                                                                        }
                                                                      }
                                                                    }
                                                                    var valid11 = _errs91 === errors2;
                                                                  } else {
                                                                    var valid11 = true;
                                                                  }
                                                                  if (valid11) {
                                                                    if (data40.textSha256 !== void 0) {
                                                                      let data44 = data40.textSha256;
                                                                      const _errs93 = errors2;
                                                                      if (errors2 === _errs93) {
                                                                        if (typeof data44 === "string") {
                                                                          if (!pattern9.test(data44)) {
                                                                            validate24.errors = [{ instancePath: instancePath + "/data/page/textSha256", schemaPath: "#/$defs/NativeBillTextSource/properties/page/properties/textSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                                                            return false;
                                                                          }
                                                                        } else {
                                                                          validate24.errors = [{ instancePath: instancePath + "/data/page/textSha256", schemaPath: "#/$defs/NativeBillTextSource/properties/page/properties/textSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                          return false;
                                                                        }
                                                                      }
                                                                      var valid11 = _errs93 === errors2;
                                                                    } else {
                                                                      var valid11 = true;
                                                                    }
                                                                    if (valid11) {
                                                                      if (data40.pageComplete !== void 0) {
                                                                        const _errs95 = errors2;
                                                                        if (true !== data40.pageComplete) {
                                                                          validate24.errors = [{ instancePath: instancePath + "/data/page/pageComplete", schemaPath: "#/$defs/NativeBillTextSource/properties/page/properties/pageComplete/const", keyword: "const", params: { allowedValue: true }, message: "must be equal to constant" }];
                                                                          return false;
                                                                        }
                                                                        var valid11 = _errs95 === errors2;
                                                                      } else {
                                                                        var valid11 = true;
                                                                      }
                                                                      if (valid11) {
                                                                        if (data40.contentComplete !== void 0) {
                                                                          const _errs96 = errors2;
                                                                          if (typeof data40.contentComplete !== "boolean") {
                                                                            validate24.errors = [{ instancePath: instancePath + "/data/page/contentComplete", schemaPath: "#/$defs/NativeBillTextSource/properties/page/properties/contentComplete/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                                                                            return false;
                                                                          }
                                                                          var valid11 = _errs96 === errors2;
                                                                        } else {
                                                                          var valid11 = true;
                                                                        }
                                                                        if (valid11) {
                                                                          if (data40.paginationComplete !== void 0) {
                                                                            const _errs98 = errors2;
                                                                            if (typeof data40.paginationComplete !== "boolean") {
                                                                              validate24.errors = [{ instancePath: instancePath + "/data/page/paginationComplete", schemaPath: "#/$defs/NativeBillTextSource/properties/page/properties/paginationComplete/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                                                                              return false;
                                                                            }
                                                                            var valid11 = _errs98 === errors2;
                                                                          } else {
                                                                            var valid11 = true;
                                                                          }
                                                                          if (valid11) {
                                                                            if (data40.truncated !== void 0) {
                                                                              const _errs100 = errors2;
                                                                              if (typeof data40.truncated !== "boolean") {
                                                                                validate24.errors = [{ instancePath: instancePath + "/data/page/truncated", schemaPath: "#/$defs/NativeBillTextSource/properties/page/properties/truncated/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                                                                                return false;
                                                                              }
                                                                              var valid11 = _errs100 === errors2;
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
                                                          validate24.errors = [{ instancePath: instancePath + "/data/page", schemaPath: "#/$defs/NativeBillTextSource/properties/page/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                          return false;
                                                        }
                                                      }
                                                      var valid8 = _errs84 === errors2;
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
                              }
                            } else {
                              validate24.errors = [{ instancePath: instancePath + "/data", schemaPath: "#/$defs/NativeBillTextSource/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                              return false;
                            }
                          }
                          var valid0 = _errs42 === errors2;
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
      validate24.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate24.errors = vErrors;
  return errors2 === 0;
}
validate24.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var pattern17 = new RegExp("^[A-Za-z0-9_-]+$", "u");
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
      if (data.schemaVersion === void 0 && (missing0 = "schemaVersion") || data.event === void 0 && (missing0 = "event") || data.current === void 0 && (missing0 = "current")) {
        validate31.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "schemaVersion" || key0 === "event" || key0 === "current")) {
            validate31.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.schemaVersion !== void 0) {
            const _errs2 = errors2;
            if ("meri.bill-text-source-read/1" !== data.schemaVersion) {
              validate31.errors = [{ instancePath: instancePath + "/schemaVersion", schemaPath: "#/properties/schemaVersion/const", keyword: "const", params: { allowedValue: "meri.bill-text-source-read/1" }, message: "must be equal to constant" }];
              return false;
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.event !== void 0) {
              const _errs3 = errors2;
              if (!validate24(data.event, { instancePath: instancePath + "/event", parentData: data, parentDataProperty: "event", rootData, dynamicAnchors })) {
                vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
                errors2 = vErrors.length;
              }
              var valid0 = _errs3 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.current !== void 0) {
                let data2 = data.current;
                const _errs4 = errors2;
                if (errors2 === _errs4) {
                  if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                    let missing1;
                    if (data2.text === void 0 && (missing1 = "text") || data2.sourceModifiedAt === void 0 && (missing1 = "sourceModifiedAt") || data2.publishedAt === void 0 && (missing1 = "publishedAt") || data2.fetchedAt === void 0 && (missing1 = "fetchedAt") || data2.coverage === void 0 && (missing1 = "coverage") || data2.sourceLocator === void 0 && (missing1 = "sourceLocator") || data2.linkStatus === void 0 && (missing1 = "linkStatus")) {
                      validate31.errors = [{ instancePath: instancePath + "/current", schemaPath: "#/properties/current/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                      return false;
                    } else {
                      const _errs6 = errors2;
                      for (const key1 in data2) {
                        if (!(key1 === "text" || key1 === "sourceModifiedAt" || key1 === "publishedAt" || key1 === "fetchedAt" || key1 === "coverage" || key1 === "sourceLocator" || key1 === "linkStatus")) {
                          validate31.errors = [{ instancePath: instancePath + "/current", schemaPath: "#/properties/current/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                          return false;
                          break;
                        }
                      }
                      if (_errs6 === errors2) {
                        if (data2.text !== void 0) {
                          let data3 = data2.text;
                          const _errs7 = errors2;
                          if (errors2 === _errs7) {
                            if (typeof data3 === "string") {
                              if (func1(data3) > 9e3) {
                                validate31.errors = [{ instancePath: instancePath + "/current/text", schemaPath: "#/properties/current/properties/text/maxLength", keyword: "maxLength", params: { limit: 9e3 }, message: "must NOT have more than 9000 characters" }];
                                return false;
                              }
                            } else {
                              validate31.errors = [{ instancePath: instancePath + "/current/text", schemaPath: "#/properties/current/properties/text/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid1 = _errs7 === errors2;
                        } else {
                          var valid1 = true;
                        }
                        if (valid1) {
                          if (data2.sourceModifiedAt !== void 0) {
                            let data4 = data2.sourceModifiedAt;
                            const _errs9 = errors2;
                            const _errs10 = errors2;
                            let valid2 = false;
                            const _errs11 = errors2;
                            if (errors2 === _errs11) {
                              if (errors2 === _errs11) {
                                if (typeof data4 === "string") {
                                  if (!formats10.validate(data4)) {
                                    const err0 = { instancePath: instancePath + "/current/sourceModifiedAt", schemaPath: "#/properties/current/properties/sourceModifiedAt/anyOf/0/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                    if (vErrors === null) {
                                      vErrors = [err0];
                                    } else {
                                      vErrors.push(err0);
                                    }
                                    errors2++;
                                  }
                                } else {
                                  const err1 = { instancePath: instancePath + "/current/sourceModifiedAt", schemaPath: "#/properties/current/properties/sourceModifiedAt/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                  if (vErrors === null) {
                                    vErrors = [err1];
                                  } else {
                                    vErrors.push(err1);
                                  }
                                  errors2++;
                                }
                              }
                            }
                            var _valid0 = _errs11 === errors2;
                            valid2 = valid2 || _valid0;
                            const _errs13 = errors2;
                            if (data4 !== null) {
                              const err2 = { instancePath: instancePath + "/current/sourceModifiedAt", schemaPath: "#/properties/current/properties/sourceModifiedAt/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                              if (vErrors === null) {
                                vErrors = [err2];
                              } else {
                                vErrors.push(err2);
                              }
                              errors2++;
                            }
                            var _valid0 = _errs13 === errors2;
                            valid2 = valid2 || _valid0;
                            if (!valid2) {
                              const err3 = { instancePath: instancePath + "/current/sourceModifiedAt", schemaPath: "#/properties/current/properties/sourceModifiedAt/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                              if (vErrors === null) {
                                vErrors = [err3];
                              } else {
                                vErrors.push(err3);
                              }
                              errors2++;
                              validate31.errors = vErrors;
                              return false;
                            } else {
                              errors2 = _errs10;
                              if (vErrors !== null) {
                                if (_errs10) {
                                  vErrors.length = _errs10;
                                } else {
                                  vErrors = null;
                                }
                              }
                            }
                            var valid1 = _errs9 === errors2;
                          } else {
                            var valid1 = true;
                          }
                          if (valid1) {
                            if (data2.publishedAt !== void 0) {
                              let data5 = data2.publishedAt;
                              const _errs15 = errors2;
                              const _errs16 = errors2;
                              let valid3 = false;
                              const _errs17 = errors2;
                              if (errors2 === _errs17) {
                                if (errors2 === _errs17) {
                                  if (typeof data5 === "string") {
                                    if (!formats10.validate(data5)) {
                                      const err4 = { instancePath: instancePath + "/current/publishedAt", schemaPath: "#/properties/current/properties/publishedAt/anyOf/0/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
                                      if (vErrors === null) {
                                        vErrors = [err4];
                                      } else {
                                        vErrors.push(err4);
                                      }
                                      errors2++;
                                    }
                                  } else {
                                    const err5 = { instancePath: instancePath + "/current/publishedAt", schemaPath: "#/properties/current/properties/publishedAt/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                    if (vErrors === null) {
                                      vErrors = [err5];
                                    } else {
                                      vErrors.push(err5);
                                    }
                                    errors2++;
                                  }
                                }
                              }
                              var _valid1 = _errs17 === errors2;
                              valid3 = valid3 || _valid1;
                              const _errs19 = errors2;
                              if (data5 !== null) {
                                const err6 = { instancePath: instancePath + "/current/publishedAt", schemaPath: "#/properties/current/properties/publishedAt/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                if (vErrors === null) {
                                  vErrors = [err6];
                                } else {
                                  vErrors.push(err6);
                                }
                                errors2++;
                              }
                              var _valid1 = _errs19 === errors2;
                              valid3 = valid3 || _valid1;
                              if (!valid3) {
                                const err7 = { instancePath: instancePath + "/current/publishedAt", schemaPath: "#/properties/current/properties/publishedAt/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                if (vErrors === null) {
                                  vErrors = [err7];
                                } else {
                                  vErrors.push(err7);
                                }
                                errors2++;
                                validate31.errors = vErrors;
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
                              var valid1 = _errs15 === errors2;
                            } else {
                              var valid1 = true;
                            }
                            if (valid1) {
                              if (data2.fetchedAt !== void 0) {
                                let data6 = data2.fetchedAt;
                                const _errs21 = errors2;
                                if (errors2 === _errs21) {
                                  if (errors2 === _errs21) {
                                    if (typeof data6 === "string") {
                                      if (!formats10.validate(data6)) {
                                        validate31.errors = [{ instancePath: instancePath + "/current/fetchedAt", schemaPath: "#/properties/current/properties/fetchedAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                                        return false;
                                      }
                                    } else {
                                      validate31.errors = [{ instancePath: instancePath + "/current/fetchedAt", schemaPath: "#/properties/current/properties/fetchedAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                      return false;
                                    }
                                  }
                                }
                                var valid1 = _errs21 === errors2;
                              } else {
                                var valid1 = true;
                              }
                              if (valid1) {
                                if (data2.coverage !== void 0) {
                                  let data7 = data2.coverage;
                                  const _errs23 = errors2;
                                  if (errors2 === _errs23) {
                                    if (data7 && typeof data7 == "object" && !Array.isArray(data7)) {
                                      let missing2;
                                      if (data7.totalCharacters === void 0 && (missing2 = "totalCharacters") || data7.pageComplete === void 0 && (missing2 = "pageComplete") || data7.contentComplete === void 0 && (missing2 = "contentComplete") || data7.paginationComplete === void 0 && (missing2 = "paginationComplete") || data7.complete === void 0 && (missing2 = "complete") || data7.truncated === void 0 && (missing2 = "truncated") || data7.nextCursor === void 0 && (missing2 = "nextCursor") || data7.locator === void 0 && (missing2 = "locator")) {
                                        validate31.errors = [{ instancePath: instancePath + "/current/coverage", schemaPath: "#/properties/current/properties/coverage/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" }];
                                        return false;
                                      } else {
                                        const _errs25 = errors2;
                                        for (const key2 in data7) {
                                          if (!(key2 === "totalCharacters" || key2 === "pageComplete" || key2 === "contentComplete" || key2 === "paginationComplete" || key2 === "complete" || key2 === "truncated" || key2 === "nextCursor" || key2 === "locator")) {
                                            validate31.errors = [{ instancePath: instancePath + "/current/coverage", schemaPath: "#/properties/current/properties/coverage/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" }];
                                            return false;
                                            break;
                                          }
                                        }
                                        if (_errs25 === errors2) {
                                          if (data7.totalCharacters !== void 0) {
                                            let data8 = data7.totalCharacters;
                                            const _errs26 = errors2;
                                            if (!(typeof data8 == "number" && (!(data8 % 1) && !isNaN(data8)) && isFinite(data8))) {
                                              validate31.errors = [{ instancePath: instancePath + "/current/coverage/totalCharacters", schemaPath: "#/properties/current/properties/coverage/properties/totalCharacters/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                              return false;
                                            }
                                            if (errors2 === _errs26) {
                                              if (typeof data8 == "number" && isFinite(data8)) {
                                                if (data8 > 9007199254740991 || isNaN(data8)) {
                                                  validate31.errors = [{ instancePath: instancePath + "/current/coverage/totalCharacters", schemaPath: "#/properties/current/properties/coverage/properties/totalCharacters/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                  return false;
                                                } else {
                                                  if (data8 < 0 || isNaN(data8)) {
                                                    validate31.errors = [{ instancePath: instancePath + "/current/coverage/totalCharacters", schemaPath: "#/properties/current/properties/coverage/properties/totalCharacters/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                    return false;
                                                  }
                                                }
                                              }
                                            }
                                            var valid4 = _errs26 === errors2;
                                          } else {
                                            var valid4 = true;
                                          }
                                          if (valid4) {
                                            if (data7.pageComplete !== void 0) {
                                              const _errs28 = errors2;
                                              if (true !== data7.pageComplete) {
                                                validate31.errors = [{ instancePath: instancePath + "/current/coverage/pageComplete", schemaPath: "#/properties/current/properties/coverage/properties/pageComplete/const", keyword: "const", params: { allowedValue: true }, message: "must be equal to constant" }];
                                                return false;
                                              }
                                              var valid4 = _errs28 === errors2;
                                            } else {
                                              var valid4 = true;
                                            }
                                            if (valid4) {
                                              if (data7.contentComplete !== void 0) {
                                                const _errs29 = errors2;
                                                if (typeof data7.contentComplete !== "boolean") {
                                                  validate31.errors = [{ instancePath: instancePath + "/current/coverage/contentComplete", schemaPath: "#/properties/current/properties/coverage/properties/contentComplete/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                                                  return false;
                                                }
                                                var valid4 = _errs29 === errors2;
                                              } else {
                                                var valid4 = true;
                                              }
                                              if (valid4) {
                                                if (data7.paginationComplete !== void 0) {
                                                  const _errs31 = errors2;
                                                  if (typeof data7.paginationComplete !== "boolean") {
                                                    validate31.errors = [{ instancePath: instancePath + "/current/coverage/paginationComplete", schemaPath: "#/properties/current/properties/coverage/properties/paginationComplete/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                                                    return false;
                                                  }
                                                  var valid4 = _errs31 === errors2;
                                                } else {
                                                  var valid4 = true;
                                                }
                                                if (valid4) {
                                                  if (data7.complete !== void 0) {
                                                    const _errs33 = errors2;
                                                    if (typeof data7.complete !== "boolean") {
                                                      validate31.errors = [{ instancePath: instancePath + "/current/coverage/complete", schemaPath: "#/properties/current/properties/coverage/properties/complete/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                                                      return false;
                                                    }
                                                    var valid4 = _errs33 === errors2;
                                                  } else {
                                                    var valid4 = true;
                                                  }
                                                  if (valid4) {
                                                    if (data7.truncated !== void 0) {
                                                      const _errs35 = errors2;
                                                      if (typeof data7.truncated !== "boolean") {
                                                        validate31.errors = [{ instancePath: instancePath + "/current/coverage/truncated", schemaPath: "#/properties/current/properties/coverage/properties/truncated/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                                                        return false;
                                                      }
                                                      var valid4 = _errs35 === errors2;
                                                    } else {
                                                      var valid4 = true;
                                                    }
                                                    if (valid4) {
                                                      if (data7.nextCursor !== void 0) {
                                                        let data14 = data7.nextCursor;
                                                        const _errs37 = errors2;
                                                        const _errs38 = errors2;
                                                        let valid5 = false;
                                                        const _errs39 = errors2;
                                                        if (errors2 === _errs39) {
                                                          if (typeof data14 === "string") {
                                                            if (func1(data14) > 1024) {
                                                              const err8 = { instancePath: instancePath + "/current/coverage/nextCursor", schemaPath: "#/properties/current/properties/coverage/properties/nextCursor/anyOf/0/maxLength", keyword: "maxLength", params: { limit: 1024 }, message: "must NOT have more than 1024 characters" };
                                                              if (vErrors === null) {
                                                                vErrors = [err8];
                                                              } else {
                                                                vErrors.push(err8);
                                                              }
                                                              errors2++;
                                                            } else {
                                                              if (func1(data14) < 1) {
                                                                const err9 = { instancePath: instancePath + "/current/coverage/nextCursor", schemaPath: "#/properties/current/properties/coverage/properties/nextCursor/anyOf/0/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                                                if (vErrors === null) {
                                                                  vErrors = [err9];
                                                                } else {
                                                                  vErrors.push(err9);
                                                                }
                                                                errors2++;
                                                              } else {
                                                                if (!pattern17.test(data14)) {
                                                                  const err10 = { instancePath: instancePath + "/current/coverage/nextCursor", schemaPath: "#/properties/current/properties/coverage/properties/nextCursor/anyOf/0/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z0-9_-]+$" }, message: 'must match pattern "^[A-Za-z0-9_-]+$"' };
                                                                  if (vErrors === null) {
                                                                    vErrors = [err10];
                                                                  } else {
                                                                    vErrors.push(err10);
                                                                  }
                                                                  errors2++;
                                                                }
                                                              }
                                                            }
                                                          } else {
                                                            const err11 = { instancePath: instancePath + "/current/coverage/nextCursor", schemaPath: "#/properties/current/properties/coverage/properties/nextCursor/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                            if (vErrors === null) {
                                                              vErrors = [err11];
                                                            } else {
                                                              vErrors.push(err11);
                                                            }
                                                            errors2++;
                                                          }
                                                        }
                                                        var _valid2 = _errs39 === errors2;
                                                        valid5 = valid5 || _valid2;
                                                        const _errs41 = errors2;
                                                        if (data14 !== null) {
                                                          const err12 = { instancePath: instancePath + "/current/coverage/nextCursor", schemaPath: "#/properties/current/properties/coverage/properties/nextCursor/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                                          if (vErrors === null) {
                                                            vErrors = [err12];
                                                          } else {
                                                            vErrors.push(err12);
                                                          }
                                                          errors2++;
                                                        }
                                                        var _valid2 = _errs41 === errors2;
                                                        valid5 = valid5 || _valid2;
                                                        if (!valid5) {
                                                          const err13 = { instancePath: instancePath + "/current/coverage/nextCursor", schemaPath: "#/properties/current/properties/coverage/properties/nextCursor/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                                          if (vErrors === null) {
                                                            vErrors = [err13];
                                                          } else {
                                                            vErrors.push(err13);
                                                          }
                                                          errors2++;
                                                          validate31.errors = vErrors;
                                                          return false;
                                                        } else {
                                                          errors2 = _errs38;
                                                          if (vErrors !== null) {
                                                            if (_errs38) {
                                                              vErrors.length = _errs38;
                                                            } else {
                                                              vErrors = null;
                                                            }
                                                          }
                                                        }
                                                        var valid4 = _errs37 === errors2;
                                                      } else {
                                                        var valid4 = true;
                                                      }
                                                      if (valid4) {
                                                        if (data7.locator !== void 0) {
                                                          let data15 = data7.locator;
                                                          const _errs43 = errors2;
                                                          if (errors2 === _errs43) {
                                                            if (data15 && typeof data15 == "object" && !Array.isArray(data15)) {
                                                              let missing3;
                                                              if (data15.offset === void 0 && (missing3 = "offset") || data15.endOffset === void 0 && (missing3 = "endOffset")) {
                                                                validate31.errors = [{ instancePath: instancePath + "/current/coverage/locator", schemaPath: "#/properties/current/properties/coverage/properties/locator/required", keyword: "required", params: { missingProperty: missing3 }, message: "must have required property '" + missing3 + "'" }];
                                                                return false;
                                                              } else {
                                                                const _errs45 = errors2;
                                                                for (const key3 in data15) {
                                                                  if (!(key3 === "offset" || key3 === "endOffset")) {
                                                                    validate31.errors = [{ instancePath: instancePath + "/current/coverage/locator", schemaPath: "#/properties/current/properties/coverage/properties/locator/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" }];
                                                                    return false;
                                                                    break;
                                                                  }
                                                                }
                                                                if (_errs45 === errors2) {
                                                                  if (data15.offset !== void 0) {
                                                                    let data16 = data15.offset;
                                                                    const _errs46 = errors2;
                                                                    if (!(typeof data16 == "number" && (!(data16 % 1) && !isNaN(data16)) && isFinite(data16))) {
                                                                      validate31.errors = [{ instancePath: instancePath + "/current/coverage/locator/offset", schemaPath: "#/properties/current/properties/coverage/properties/locator/properties/offset/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                      return false;
                                                                    }
                                                                    if (errors2 === _errs46) {
                                                                      if (typeof data16 == "number" && isFinite(data16)) {
                                                                        if (data16 > 9007199254740991 || isNaN(data16)) {
                                                                          validate31.errors = [{ instancePath: instancePath + "/current/coverage/locator/offset", schemaPath: "#/properties/current/properties/coverage/properties/locator/properties/offset/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                          return false;
                                                                        } else {
                                                                          if (data16 < 0 || isNaN(data16)) {
                                                                            validate31.errors = [{ instancePath: instancePath + "/current/coverage/locator/offset", schemaPath: "#/properties/current/properties/coverage/properties/locator/properties/offset/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                            return false;
                                                                          }
                                                                        }
                                                                      }
                                                                    }
                                                                    var valid6 = _errs46 === errors2;
                                                                  } else {
                                                                    var valid6 = true;
                                                                  }
                                                                  if (valid6) {
                                                                    if (data15.endOffset !== void 0) {
                                                                      let data17 = data15.endOffset;
                                                                      const _errs48 = errors2;
                                                                      if (!(typeof data17 == "number" && (!(data17 % 1) && !isNaN(data17)) && isFinite(data17))) {
                                                                        validate31.errors = [{ instancePath: instancePath + "/current/coverage/locator/endOffset", schemaPath: "#/properties/current/properties/coverage/properties/locator/properties/endOffset/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                        return false;
                                                                      }
                                                                      if (errors2 === _errs48) {
                                                                        if (typeof data17 == "number" && isFinite(data17)) {
                                                                          if (data17 > 9007199254740991 || isNaN(data17)) {
                                                                            validate31.errors = [{ instancePath: instancePath + "/current/coverage/locator/endOffset", schemaPath: "#/properties/current/properties/coverage/properties/locator/properties/endOffset/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                            return false;
                                                                          } else {
                                                                            if (data17 < 0 || isNaN(data17)) {
                                                                              validate31.errors = [{ instancePath: instancePath + "/current/coverage/locator/endOffset", schemaPath: "#/properties/current/properties/coverage/properties/locator/properties/endOffset/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                              return false;
                                                                            }
                                                                          }
                                                                        }
                                                                      }
                                                                      var valid6 = _errs48 === errors2;
                                                                    } else {
                                                                      var valid6 = true;
                                                                    }
                                                                  }
                                                                }
                                                              }
                                                            } else {
                                                              validate31.errors = [{ instancePath: instancePath + "/current/coverage/locator", schemaPath: "#/properties/current/properties/coverage/properties/locator/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                              return false;
                                                            }
                                                          }
                                                          var valid4 = _errs43 === errors2;
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
                                      }
                                    } else {
                                      validate31.errors = [{ instancePath: instancePath + "/current/coverage", schemaPath: "#/properties/current/properties/coverage/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                      return false;
                                    }
                                  }
                                  var valid1 = _errs23 === errors2;
                                } else {
                                  var valid1 = true;
                                }
                                if (valid1) {
                                  if (data2.sourceLocator !== void 0) {
                                    let data18 = data2.sourceLocator;
                                    const _errs50 = errors2;
                                    const _errs51 = errors2;
                                    let valid7 = false;
                                    const _errs52 = errors2;
                                    if (errors2 === _errs52) {
                                      if (typeof data18 === "string") {
                                        if (func1(data18) > 4096) {
                                          const err14 = { instancePath: instancePath + "/current/sourceLocator", schemaPath: "#/properties/current/properties/sourceLocator/anyOf/0/maxLength", keyword: "maxLength", params: { limit: 4096 }, message: "must NOT have more than 4096 characters" };
                                          if (vErrors === null) {
                                            vErrors = [err14];
                                          } else {
                                            vErrors.push(err14);
                                          }
                                          errors2++;
                                        }
                                      } else {
                                        const err15 = { instancePath: instancePath + "/current/sourceLocator", schemaPath: "#/properties/current/properties/sourceLocator/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                        if (vErrors === null) {
                                          vErrors = [err15];
                                        } else {
                                          vErrors.push(err15);
                                        }
                                        errors2++;
                                      }
                                    }
                                    var _valid3 = _errs52 === errors2;
                                    valid7 = valid7 || _valid3;
                                    const _errs54 = errors2;
                                    if (data18 !== null) {
                                      const err16 = { instancePath: instancePath + "/current/sourceLocator", schemaPath: "#/properties/current/properties/sourceLocator/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                      if (vErrors === null) {
                                        vErrors = [err16];
                                      } else {
                                        vErrors.push(err16);
                                      }
                                      errors2++;
                                    }
                                    var _valid3 = _errs54 === errors2;
                                    valid7 = valid7 || _valid3;
                                    if (!valid7) {
                                      const err17 = { instancePath: instancePath + "/current/sourceLocator", schemaPath: "#/properties/current/properties/sourceLocator/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                      if (vErrors === null) {
                                        vErrors = [err17];
                                      } else {
                                        vErrors.push(err17);
                                      }
                                      errors2++;
                                      validate31.errors = vErrors;
                                      return false;
                                    } else {
                                      errors2 = _errs51;
                                      if (vErrors !== null) {
                                        if (_errs51) {
                                          vErrors.length = _errs51;
                                        } else {
                                          vErrors = null;
                                        }
                                      }
                                    }
                                    var valid1 = _errs50 === errors2;
                                  } else {
                                    var valid1 = true;
                                  }
                                  if (valid1) {
                                    if (data2.linkStatus !== void 0) {
                                      let data19 = data2.linkStatus;
                                      const _errs56 = errors2;
                                      if (!(data19 === "available" || data19 === "unsafe")) {
                                        validate31.errors = [{ instancePath: instancePath + "/current/linkStatus", schemaPath: "#/properties/current/properties/linkStatus/enum", keyword: "enum", params: { allowedValues: schema35.properties.current.properties.linkStatus.enum }, message: "must be equal to one of the allowed values" }];
                                        return false;
                                      }
                                      var valid1 = _errs56 === errors2;
                                    } else {
                                      var valid1 = true;
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
                    validate31.errors = [{ instancePath: instancePath + "/current", schemaPath: "#/properties/current/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
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
var validateEvent = validate33;
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
      if (data.contractVersion === void 0 && (missing0 = "contractVersion") || data.eventId === void 0 && (missing0 = "eventId") || data.binding === void 0 && (missing0 = "binding") || data.sequence === void 0 && (missing0 = "sequence") || data.createdAt === void 0 && (missing0 = "createdAt") || data.scopes === void 0 && (missing0 = "scopes") || data.type === void 0 && (missing0 = "type") || data.data === void 0 && (missing0 = "data")) {
        validate33.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "contractVersion" || key0 === "eventId" || key0 === "binding" || key0 === "sequence" || key0 === "createdAt" || key0 === "scopes" || key0 === "type" || key0 === "data")) {
            validate33.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.contractVersion !== void 0) {
            const _errs2 = errors2;
            if ("0.1.0" !== data.contractVersion) {
              validate33.errors = [{ instancePath: instancePath + "/contractVersion", schemaPath: "#/properties/contractVersion/const", keyword: "const", params: { allowedValue: "0.1.0" }, message: "must be equal to constant" }];
              return false;
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.eventId !== void 0) {
              let data1 = data.eventId;
              const _errs3 = errors2;
              if (errors2 === _errs3) {
                if (errors2 === _errs3) {
                  if (typeof data1 === "string") {
                    if (!formats0.test(data1)) {
                      validate33.errors = [{ instancePath: instancePath + "/eventId", schemaPath: "#/properties/eventId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                      return false;
                    }
                  } else {
                    validate33.errors = [{ instancePath: instancePath + "/eventId", schemaPath: "#/properties/eventId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                      validate33.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                      return false;
                    } else {
                      const _errs8 = errors2;
                      for (const key1 in data2) {
                        if (!(key1 === "tenantId" || key1 === "actorId" || key1 === "conversationId" || key1 === "runId" || key1 === "attemptId" || key1 === "workerId" || key1 === "writerFence")) {
                          validate33.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
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
                                validate33.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                return false;
                              } else {
                                if (func1(data3) < 1) {
                                  validate33.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                  return false;
                                }
                              }
                            } else {
                              validate33.errors = [{ instancePath: instancePath + "/binding/tenantId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                  validate33.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                  return false;
                                } else {
                                  if (func1(data4) < 1) {
                                    validate33.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                    return false;
                                  }
                                }
                              } else {
                                validate33.errors = [{ instancePath: instancePath + "/binding/actorId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/actorId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                      validate33.errors = [{ instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                      return false;
                                    }
                                  } else {
                                    validate33.errors = [{ instancePath: instancePath + "/binding/conversationId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                        validate33.errors = [{ instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                        return false;
                                      }
                                    } else {
                                      validate33.errors = [{ instancePath: instancePath + "/binding/runId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                          validate33.errors = [{ instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                          return false;
                                        }
                                      } else {
                                        validate33.errors = [{ instancePath: instancePath + "/binding/attemptId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/attemptId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                            validate33.errors = [{ instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                                            return false;
                                          }
                                        } else {
                                          validate33.errors = [{ instancePath: instancePath + "/binding/workerId", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/workerId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                        validate33.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                        return false;
                                      }
                                      if (errors2 === _errs21) {
                                        if (typeof data9 == "number" && isFinite(data9)) {
                                          if (data9 > 9007199254740991 || isNaN(data9)) {
                                            validate33.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                            return false;
                                          } else {
                                            if (data9 < 1 || isNaN(data9)) {
                                              validate33.errors = [{ instancePath: instancePath + "/binding/writerFence", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/properties/writerFence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
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
                    validate33.errors = [{ instancePath: instancePath + "/binding", schemaPath: "#/$defs/Canonical_RunBinding_84f2304c/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                    return false;
                  }
                }
                var valid0 = _errs5 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.sequence !== void 0) {
                  let data10 = data.sequence;
                  const _errs23 = errors2;
                  if (!(typeof data10 == "number" && (!(data10 % 1) && !isNaN(data10)) && isFinite(data10))) {
                    validate33.errors = [{ instancePath: instancePath + "/sequence", schemaPath: "#/properties/sequence/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                    return false;
                  }
                  if (errors2 === _errs23) {
                    if (typeof data10 == "number" && isFinite(data10)) {
                      if (data10 > 9007199254740991 || isNaN(data10)) {
                        validate33.errors = [{ instancePath: instancePath + "/sequence", schemaPath: "#/properties/sequence/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                        return false;
                      } else {
                        if (data10 < 1 || isNaN(data10)) {
                          validate33.errors = [{ instancePath: instancePath + "/sequence", schemaPath: "#/properties/sequence/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                          return false;
                        }
                      }
                    }
                  }
                  var valid0 = _errs23 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.createdAt !== void 0) {
                    let data11 = data.createdAt;
                    const _errs25 = errors2;
                    if (errors2 === _errs25) {
                      if (errors2 === _errs25) {
                        if (typeof data11 === "string") {
                          if (!pattern7.test(data11)) {
                            validate33.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                            return false;
                          } else {
                            if (!formats10.validate(data11)) {
                              validate33.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                              return false;
                            }
                          }
                        } else {
                          validate33.errors = [{ instancePath: instancePath + "/createdAt", schemaPath: "#/properties/createdAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                          return false;
                        }
                      }
                    }
                    var valid0 = _errs25 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.scopes !== void 0) {
                      let data12 = data.scopes;
                      const _errs27 = errors2;
                      if (errors2 === _errs27) {
                        if (Array.isArray(data12)) {
                          if (data12.length < 1) {
                            validate33.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                            return false;
                          } else {
                            var valid3 = true;
                            const len0 = data12.length;
                            for (let i0 = 0; i0 < len0; i0++) {
                              let data13 = data12[i0];
                              const _errs29 = errors2;
                              const _errs30 = errors2;
                              if (errors2 === _errs30) {
                                if (data13 && typeof data13 == "object" && !Array.isArray(data13)) {
                                  let missing2;
                                  if (data13.tenantId === void 0 && (missing2 = "tenantId") || data13.kind === void 0 && (missing2 = "kind") || data13.resourceId === void 0 && (missing2 = "resourceId") || data13.policyRevision === void 0 && (missing2 = "policyRevision")) {
                                    validate33.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" }];
                                    return false;
                                  } else {
                                    const _errs32 = errors2;
                                    for (const key2 in data13) {
                                      if (!(key2 === "tenantId" || key2 === "kind" || key2 === "resourceId" || key2 === "policyRevision")) {
                                        validate33.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" }];
                                        return false;
                                        break;
                                      }
                                    }
                                    if (_errs32 === errors2) {
                                      if (data13.tenantId !== void 0) {
                                        let data14 = data13.tenantId;
                                        const _errs33 = errors2;
                                        if (errors2 === _errs33) {
                                          if (typeof data14 === "string") {
                                            if (func1(data14) > 128) {
                                              validate33.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                              return false;
                                            } else {
                                              if (func1(data14) < 1) {
                                                validate33.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                return false;
                                              }
                                            }
                                          } else {
                                            validate33.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/tenantId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/tenantId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                            return false;
                                          }
                                        }
                                        var valid5 = _errs33 === errors2;
                                      } else {
                                        var valid5 = true;
                                      }
                                      if (valid5) {
                                        if (data13.kind !== void 0) {
                                          let data15 = data13.kind;
                                          const _errs35 = errors2;
                                          if (typeof data15 !== "string") {
                                            validate33.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                            return false;
                                          }
                                          if (!(data15 === "tenant" || data15 === "client" || data15 === "mailbox" || data15 === "memory" || data15 === "document" || data15 === "private-user" || data15 === "public")) {
                                            validate33.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/kind", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/kind/enum", keyword: "enum", params: { allowedValues: schema38.properties.kind.enum }, message: "must be equal to one of the allowed values" }];
                                            return false;
                                          }
                                          var valid5 = _errs35 === errors2;
                                        } else {
                                          var valid5 = true;
                                        }
                                        if (valid5) {
                                          if (data13.resourceId !== void 0) {
                                            let data16 = data13.resourceId;
                                            const _errs37 = errors2;
                                            if (errors2 === _errs37) {
                                              if (typeof data16 === "string") {
                                                if (func1(data16) > 256) {
                                                  validate33.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/maxLength", keyword: "maxLength", params: { limit: 256 }, message: "must NOT have more than 256 characters" }];
                                                  return false;
                                                } else {
                                                  if (func1(data16) < 1) {
                                                    validate33.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                    return false;
                                                  }
                                                }
                                              } else {
                                                validate33.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/resourceId", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/resourceId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                return false;
                                              }
                                            }
                                            var valid5 = _errs37 === errors2;
                                          } else {
                                            var valid5 = true;
                                          }
                                          if (valid5) {
                                            if (data13.policyRevision !== void 0) {
                                              let data17 = data13.policyRevision;
                                              const _errs39 = errors2;
                                              if (errors2 === _errs39) {
                                                if (typeof data17 === "string") {
                                                  if (func1(data17) > 128) {
                                                    validate33.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" }];
                                                    return false;
                                                  } else {
                                                    if (func1(data17) < 1) {
                                                      validate33.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                      return false;
                                                    }
                                                  }
                                                } else {
                                                  validate33.errors = [{ instancePath: instancePath + "/scopes/" + i0 + "/policyRevision", schemaPath: "#/$defs/Canonical_Scope_f882edb5/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                  return false;
                                                }
                                              }
                                              var valid5 = _errs39 === errors2;
                                            } else {
                                              var valid5 = true;
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }
                                } else {
                                  validate33.errors = [{ instancePath: instancePath + "/scopes/" + i0, schemaPath: "#/$defs/Canonical_Scope_f882edb5/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                  return false;
                                }
                              }
                              var valid3 = _errs29 === errors2;
                              if (!valid3) {
                                break;
                              }
                            }
                            if (valid3) {
                              let i1 = data12.length;
                              let j0;
                              if (i1 > 1) {
                                outer0: for (; i1--; ) {
                                  for (j0 = i1; j0--; ) {
                                    if (func0(data12[i1], data12[j0])) {
                                      validate33.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/uniqueItems", keyword: "uniqueItems", params: { i: i1, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)" }];
                                      return false;
                                      break outer0;
                                    }
                                  }
                                }
                              }
                            }
                          }
                        } else {
                          validate33.errors = [{ instancePath: instancePath + "/scopes", schemaPath: "#/properties/scopes/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                          return false;
                        }
                      }
                      var valid0 = _errs27 === errors2;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.type !== void 0) {
                        const _errs41 = errors2;
                        if ("source.native-bill-text" !== data.type) {
                          validate33.errors = [{ instancePath: instancePath + "/type", schemaPath: "#/properties/type/const", keyword: "const", params: { allowedValue: "source.native-bill-text" }, message: "must be equal to constant" }];
                          return false;
                        }
                        var valid0 = _errs41 === errors2;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.data !== void 0) {
                          let data19 = data.data;
                          const _errs42 = errors2;
                          const _errs43 = errors2;
                          if (errors2 === _errs43) {
                            if (data19 && typeof data19 == "object" && !Array.isArray(data19)) {
                              let missing3;
                              if (data19.schemaVersion === void 0 && (missing3 = "schemaVersion") || data19.deliveryId === void 0 && (missing3 = "deliveryId") || data19.operation === void 0 && (missing3 = "operation") || data19.requestSha256 === void 0 && (missing3 = "requestSha256") || data19.argumentsSha256 === void 0 && (missing3 = "argumentsSha256") || data19.resultSha256 === void 0 && (missing3 = "resultSha256") || data19.executionSha256 === void 0 && (missing3 = "executionSha256") || data19.policyRevision === void 0 && (missing3 = "policyRevision") || data19.source === void 0 && (missing3 = "source") || data19.page === void 0 && (missing3 = "page")) {
                                validate33.errors = [{ instancePath: instancePath + "/data", schemaPath: "#/$defs/NativeBillTextSource/required", keyword: "required", params: { missingProperty: missing3 }, message: "must have required property '" + missing3 + "'" }];
                                return false;
                              } else {
                                const _errs45 = errors2;
                                for (const key3 in data19) {
                                  if (!func12.call(schema39.properties, key3)) {
                                    validate33.errors = [{ instancePath: instancePath + "/data", schemaPath: "#/$defs/NativeBillTextSource/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" }];
                                    return false;
                                    break;
                                  }
                                }
                                if (_errs45 === errors2) {
                                  if (data19.schemaVersion !== void 0) {
                                    const _errs46 = errors2;
                                    if ("meri.native-bill-text-source/1" !== data19.schemaVersion) {
                                      validate33.errors = [{ instancePath: instancePath + "/data/schemaVersion", schemaPath: "#/$defs/NativeBillTextSource/properties/schemaVersion/const", keyword: "const", params: { allowedValue: "meri.native-bill-text-source/1" }, message: "must be equal to constant" }];
                                      return false;
                                    }
                                    var valid8 = _errs46 === errors2;
                                  } else {
                                    var valid8 = true;
                                  }
                                  if (valid8) {
                                    if (data19.deliveryId !== void 0) {
                                      let data21 = data19.deliveryId;
                                      const _errs47 = errors2;
                                      if (errors2 === _errs47) {
                                        if (typeof data21 === "string") {
                                          if (!pattern8.test(data21)) {
                                            validate33.errors = [{ instancePath: instancePath + "/data/deliveryId", schemaPath: "#/$defs/NativeBillTextSource/properties/deliveryId/pattern", keyword: "pattern", params: { pattern: "^[-A-Za-z0-9_.:@/]{1,255}$" }, message: 'must match pattern "^[-A-Za-z0-9_.:@/]{1,255}$"' }];
                                            return false;
                                          }
                                        } else {
                                          validate33.errors = [{ instancePath: instancePath + "/data/deliveryId", schemaPath: "#/$defs/NativeBillTextSource/properties/deliveryId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                          return false;
                                        }
                                      }
                                      var valid8 = _errs47 === errors2;
                                    } else {
                                      var valid8 = true;
                                    }
                                    if (valid8) {
                                      if (data19.operation !== void 0) {
                                        let data22 = data19.operation;
                                        const _errs49 = errors2;
                                        if (errors2 === _errs49) {
                                          if (data22 && typeof data22 == "object" && !Array.isArray(data22)) {
                                            let missing4;
                                            if (data22.id === void 0 && (missing4 = "id") || data22.version === void 0 && (missing4 = "version")) {
                                              validate33.errors = [{ instancePath: instancePath + "/data/operation", schemaPath: "#/$defs/NativeBillTextSource/properties/operation/required", keyword: "required", params: { missingProperty: missing4 }, message: "must have required property '" + missing4 + "'" }];
                                              return false;
                                            } else {
                                              const _errs51 = errors2;
                                              for (const key4 in data22) {
                                                if (!(key4 === "id" || key4 === "version")) {
                                                  validate33.errors = [{ instancePath: instancePath + "/data/operation", schemaPath: "#/$defs/NativeBillTextSource/properties/operation/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key4 }, message: "must NOT have additional properties" }];
                                                  return false;
                                                  break;
                                                }
                                              }
                                              if (_errs51 === errors2) {
                                                if (data22.id !== void 0) {
                                                  const _errs52 = errors2;
                                                  if ("read_bill_text" !== data22.id) {
                                                    validate33.errors = [{ instancePath: instancePath + "/data/operation/id", schemaPath: "#/$defs/NativeBillTextSource/properties/operation/properties/id/const", keyword: "const", params: { allowedValue: "read_bill_text" }, message: "must be equal to constant" }];
                                                    return false;
                                                  }
                                                  var valid9 = _errs52 === errors2;
                                                } else {
                                                  var valid9 = true;
                                                }
                                                if (valid9) {
                                                  if (data22.version !== void 0) {
                                                    const _errs53 = errors2;
                                                    if ("0.2.0" !== data22.version) {
                                                      validate33.errors = [{ instancePath: instancePath + "/data/operation/version", schemaPath: "#/$defs/NativeBillTextSource/properties/operation/properties/version/const", keyword: "const", params: { allowedValue: "0.2.0" }, message: "must be equal to constant" }];
                                                      return false;
                                                    }
                                                    var valid9 = _errs53 === errors2;
                                                  } else {
                                                    var valid9 = true;
                                                  }
                                                }
                                              }
                                            }
                                          } else {
                                            validate33.errors = [{ instancePath: instancePath + "/data/operation", schemaPath: "#/$defs/NativeBillTextSource/properties/operation/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                            return false;
                                          }
                                        }
                                        var valid8 = _errs49 === errors2;
                                      } else {
                                        var valid8 = true;
                                      }
                                      if (valid8) {
                                        if (data19.requestSha256 !== void 0) {
                                          let data25 = data19.requestSha256;
                                          const _errs54 = errors2;
                                          if (errors2 === _errs54) {
                                            if (typeof data25 === "string") {
                                              if (!pattern9.test(data25)) {
                                                validate33.errors = [{ instancePath: instancePath + "/data/requestSha256", schemaPath: "#/$defs/NativeBillTextSource/properties/requestSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                                return false;
                                              }
                                            } else {
                                              validate33.errors = [{ instancePath: instancePath + "/data/requestSha256", schemaPath: "#/$defs/NativeBillTextSource/properties/requestSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                              return false;
                                            }
                                          }
                                          var valid8 = _errs54 === errors2;
                                        } else {
                                          var valid8 = true;
                                        }
                                        if (valid8) {
                                          if (data19.argumentsSha256 !== void 0) {
                                            let data26 = data19.argumentsSha256;
                                            const _errs56 = errors2;
                                            if (errors2 === _errs56) {
                                              if (typeof data26 === "string") {
                                                if (!pattern9.test(data26)) {
                                                  validate33.errors = [{ instancePath: instancePath + "/data/argumentsSha256", schemaPath: "#/$defs/NativeBillTextSource/properties/argumentsSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                                  return false;
                                                }
                                              } else {
                                                validate33.errors = [{ instancePath: instancePath + "/data/argumentsSha256", schemaPath: "#/$defs/NativeBillTextSource/properties/argumentsSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                return false;
                                              }
                                            }
                                            var valid8 = _errs56 === errors2;
                                          } else {
                                            var valid8 = true;
                                          }
                                          if (valid8) {
                                            if (data19.resultSha256 !== void 0) {
                                              let data27 = data19.resultSha256;
                                              const _errs58 = errors2;
                                              if (errors2 === _errs58) {
                                                if (typeof data27 === "string") {
                                                  if (!pattern9.test(data27)) {
                                                    validate33.errors = [{ instancePath: instancePath + "/data/resultSha256", schemaPath: "#/$defs/NativeBillTextSource/properties/resultSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                                    return false;
                                                  }
                                                } else {
                                                  validate33.errors = [{ instancePath: instancePath + "/data/resultSha256", schemaPath: "#/$defs/NativeBillTextSource/properties/resultSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                  return false;
                                                }
                                              }
                                              var valid8 = _errs58 === errors2;
                                            } else {
                                              var valid8 = true;
                                            }
                                            if (valid8) {
                                              if (data19.executionSha256 !== void 0) {
                                                let data28 = data19.executionSha256;
                                                const _errs60 = errors2;
                                                if (errors2 === _errs60) {
                                                  if (typeof data28 === "string") {
                                                    if (!pattern9.test(data28)) {
                                                      validate33.errors = [{ instancePath: instancePath + "/data/executionSha256", schemaPath: "#/$defs/NativeBillTextSource/properties/executionSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                                      return false;
                                                    }
                                                  } else {
                                                    validate33.errors = [{ instancePath: instancePath + "/data/executionSha256", schemaPath: "#/$defs/NativeBillTextSource/properties/executionSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                    return false;
                                                  }
                                                }
                                                var valid8 = _errs60 === errors2;
                                              } else {
                                                var valid8 = true;
                                              }
                                              if (valid8) {
                                                if (data19.policyRevision !== void 0) {
                                                  let data29 = data19.policyRevision;
                                                  const _errs62 = errors2;
                                                  if (errors2 === _errs62) {
                                                    if (typeof data29 === "string") {
                                                      if (func1(data29) > 255) {
                                                        validate33.errors = [{ instancePath: instancePath + "/data/policyRevision", schemaPath: "#/$defs/NativeBillTextSource/properties/policyRevision/maxLength", keyword: "maxLength", params: { limit: 255 }, message: "must NOT have more than 255 characters" }];
                                                        return false;
                                                      } else {
                                                        if (func1(data29) < 1) {
                                                          validate33.errors = [{ instancePath: instancePath + "/data/policyRevision", schemaPath: "#/$defs/NativeBillTextSource/properties/policyRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                          return false;
                                                        }
                                                      }
                                                    } else {
                                                      validate33.errors = [{ instancePath: instancePath + "/data/policyRevision", schemaPath: "#/$defs/NativeBillTextSource/properties/policyRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                      return false;
                                                    }
                                                  }
                                                  var valid8 = _errs62 === errors2;
                                                } else {
                                                  var valid8 = true;
                                                }
                                                if (valid8) {
                                                  if (data19.source !== void 0) {
                                                    let data30 = data19.source;
                                                    const _errs64 = errors2;
                                                    if (errors2 === _errs64) {
                                                      if (data30 && typeof data30 == "object" && !Array.isArray(data30)) {
                                                        let missing5;
                                                        if (data30.authoritativeOwner === void 0 && (missing5 = "authoritativeOwner") || data30.billId === void 0 && (missing5 = "billId") || data30.versionCode === void 0 && (missing5 = "versionCode") || data30.revisionId === void 0 && (missing5 = "revisionId") || data30.packageId === void 0 && (missing5 = "packageId") || data30.provider === void 0 && (missing5 = "provider") || data30.lineageKey === void 0 && (missing5 = "lineageKey") || data30.versionHash === void 0 && (missing5 = "versionHash") || data30.textHash === void 0 && (missing5 = "textHash")) {
                                                          validate33.errors = [{ instancePath: instancePath + "/data/source", schemaPath: "#/$defs/NativeBillTextSource/properties/source/required", keyword: "required", params: { missingProperty: missing5 }, message: "must have required property '" + missing5 + "'" }];
                                                          return false;
                                                        } else {
                                                          const _errs66 = errors2;
                                                          for (const key5 in data30) {
                                                            if (!func12.call(schema39.properties.source.properties, key5)) {
                                                              validate33.errors = [{ instancePath: instancePath + "/data/source", schemaPath: "#/$defs/NativeBillTextSource/properties/source/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key5 }, message: "must NOT have additional properties" }];
                                                              return false;
                                                              break;
                                                            }
                                                          }
                                                          if (_errs66 === errors2) {
                                                            if (data30.authoritativeOwner !== void 0) {
                                                              const _errs67 = errors2;
                                                              if ("federal_evidence_current" !== data30.authoritativeOwner) {
                                                                validate33.errors = [{ instancePath: instancePath + "/data/source/authoritativeOwner", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/authoritativeOwner/const", keyword: "const", params: { allowedValue: "federal_evidence_current" }, message: "must be equal to constant" }];
                                                                return false;
                                                              }
                                                              var valid10 = _errs67 === errors2;
                                                            } else {
                                                              var valid10 = true;
                                                            }
                                                            if (valid10) {
                                                              if (data30.billId !== void 0) {
                                                                let data32 = data30.billId;
                                                                const _errs68 = errors2;
                                                                if (errors2 === _errs68) {
                                                                  if (typeof data32 === "string") {
                                                                    if (func1(data32) > 255) {
                                                                      validate33.errors = [{ instancePath: instancePath + "/data/source/billId", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/billId/maxLength", keyword: "maxLength", params: { limit: 255 }, message: "must NOT have more than 255 characters" }];
                                                                      return false;
                                                                    } else {
                                                                      if (func1(data32) < 1) {
                                                                        validate33.errors = [{ instancePath: instancePath + "/data/source/billId", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/billId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                                        return false;
                                                                      }
                                                                    }
                                                                  } else {
                                                                    validate33.errors = [{ instancePath: instancePath + "/data/source/billId", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/billId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                    return false;
                                                                  }
                                                                }
                                                                var valid10 = _errs68 === errors2;
                                                              } else {
                                                                var valid10 = true;
                                                              }
                                                              if (valid10) {
                                                                if (data30.versionCode !== void 0) {
                                                                  let data33 = data30.versionCode;
                                                                  const _errs70 = errors2;
                                                                  if (errors2 === _errs70) {
                                                                    if (typeof data33 === "string") {
                                                                      if (func1(data33) > 255) {
                                                                        validate33.errors = [{ instancePath: instancePath + "/data/source/versionCode", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/versionCode/maxLength", keyword: "maxLength", params: { limit: 255 }, message: "must NOT have more than 255 characters" }];
                                                                        return false;
                                                                      } else {
                                                                        if (func1(data33) < 1) {
                                                                          validate33.errors = [{ instancePath: instancePath + "/data/source/versionCode", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/versionCode/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                                          return false;
                                                                        }
                                                                      }
                                                                    } else {
                                                                      validate33.errors = [{ instancePath: instancePath + "/data/source/versionCode", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/versionCode/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                      return false;
                                                                    }
                                                                  }
                                                                  var valid10 = _errs70 === errors2;
                                                                } else {
                                                                  var valid10 = true;
                                                                }
                                                                if (valid10) {
                                                                  if (data30.revisionId !== void 0) {
                                                                    let data34 = data30.revisionId;
                                                                    const _errs72 = errors2;
                                                                    if (errors2 === _errs72) {
                                                                      if (typeof data34 === "string") {
                                                                        if (!pattern13.test(data34)) {
                                                                          validate33.errors = [{ instancePath: instancePath + "/data/source/revisionId", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/revisionId/pattern", keyword: "pattern", params: { pattern: "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$" }, message: 'must match pattern "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"' }];
                                                                          return false;
                                                                        }
                                                                      } else {
                                                                        validate33.errors = [{ instancePath: instancePath + "/data/source/revisionId", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/revisionId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                        return false;
                                                                      }
                                                                    }
                                                                    var valid10 = _errs72 === errors2;
                                                                  } else {
                                                                    var valid10 = true;
                                                                  }
                                                                  if (valid10) {
                                                                    if (data30.packageId !== void 0) {
                                                                      let data35 = data30.packageId;
                                                                      const _errs74 = errors2;
                                                                      if (errors2 === _errs74) {
                                                                        if (typeof data35 === "string") {
                                                                          if (func1(data35) > 255) {
                                                                            validate33.errors = [{ instancePath: instancePath + "/data/source/packageId", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/packageId/maxLength", keyword: "maxLength", params: { limit: 255 }, message: "must NOT have more than 255 characters" }];
                                                                            return false;
                                                                          } else {
                                                                            if (func1(data35) < 1) {
                                                                              validate33.errors = [{ instancePath: instancePath + "/data/source/packageId", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/packageId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                                              return false;
                                                                            }
                                                                          }
                                                                        } else {
                                                                          validate33.errors = [{ instancePath: instancePath + "/data/source/packageId", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/packageId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                          return false;
                                                                        }
                                                                      }
                                                                      var valid10 = _errs74 === errors2;
                                                                    } else {
                                                                      var valid10 = true;
                                                                    }
                                                                    if (valid10) {
                                                                      if (data30.provider !== void 0) {
                                                                        let data36 = data30.provider;
                                                                        const _errs76 = errors2;
                                                                        if (errors2 === _errs76) {
                                                                          if (typeof data36 === "string") {
                                                                            if (func1(data36) > 255) {
                                                                              validate33.errors = [{ instancePath: instancePath + "/data/source/provider", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/provider/maxLength", keyword: "maxLength", params: { limit: 255 }, message: "must NOT have more than 255 characters" }];
                                                                              return false;
                                                                            } else {
                                                                              if (func1(data36) < 1) {
                                                                                validate33.errors = [{ instancePath: instancePath + "/data/source/provider", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/provider/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                                                return false;
                                                                              }
                                                                            }
                                                                          } else {
                                                                            validate33.errors = [{ instancePath: instancePath + "/data/source/provider", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/provider/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                            return false;
                                                                          }
                                                                        }
                                                                        var valid10 = _errs76 === errors2;
                                                                      } else {
                                                                        var valid10 = true;
                                                                      }
                                                                      if (valid10) {
                                                                        if (data30.lineageKey !== void 0) {
                                                                          let data37 = data30.lineageKey;
                                                                          const _errs78 = errors2;
                                                                          if (errors2 === _errs78) {
                                                                            if (typeof data37 === "string") {
                                                                              if (func1(data37) > 4096) {
                                                                                validate33.errors = [{ instancePath: instancePath + "/data/source/lineageKey", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/lineageKey/maxLength", keyword: "maxLength", params: { limit: 4096 }, message: "must NOT have more than 4096 characters" }];
                                                                                return false;
                                                                              } else {
                                                                                if (func1(data37) < 1) {
                                                                                  validate33.errors = [{ instancePath: instancePath + "/data/source/lineageKey", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/lineageKey/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                                                  return false;
                                                                                }
                                                                              }
                                                                            } else {
                                                                              validate33.errors = [{ instancePath: instancePath + "/data/source/lineageKey", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/lineageKey/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                              return false;
                                                                            }
                                                                          }
                                                                          var valid10 = _errs78 === errors2;
                                                                        } else {
                                                                          var valid10 = true;
                                                                        }
                                                                        if (valid10) {
                                                                          if (data30.versionHash !== void 0) {
                                                                            let data38 = data30.versionHash;
                                                                            const _errs80 = errors2;
                                                                            if (errors2 === _errs80) {
                                                                              if (typeof data38 === "string") {
                                                                                if (!pattern9.test(data38)) {
                                                                                  validate33.errors = [{ instancePath: instancePath + "/data/source/versionHash", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/versionHash/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                                                                  return false;
                                                                                }
                                                                              } else {
                                                                                validate33.errors = [{ instancePath: instancePath + "/data/source/versionHash", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/versionHash/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                                return false;
                                                                              }
                                                                            }
                                                                            var valid10 = _errs80 === errors2;
                                                                          } else {
                                                                            var valid10 = true;
                                                                          }
                                                                          if (valid10) {
                                                                            if (data30.textHash !== void 0) {
                                                                              let data39 = data30.textHash;
                                                                              const _errs82 = errors2;
                                                                              if (errors2 === _errs82) {
                                                                                if (typeof data39 === "string") {
                                                                                  if (!pattern9.test(data39)) {
                                                                                    validate33.errors = [{ instancePath: instancePath + "/data/source/textHash", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/textHash/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                                                                    return false;
                                                                                  }
                                                                                } else {
                                                                                  validate33.errors = [{ instancePath: instancePath + "/data/source/textHash", schemaPath: "#/$defs/NativeBillTextSource/properties/source/properties/textHash/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                                  return false;
                                                                                }
                                                                              }
                                                                              var valid10 = _errs82 === errors2;
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
                                                        validate33.errors = [{ instancePath: instancePath + "/data/source", schemaPath: "#/$defs/NativeBillTextSource/properties/source/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                        return false;
                                                      }
                                                    }
                                                    var valid8 = _errs64 === errors2;
                                                  } else {
                                                    var valid8 = true;
                                                  }
                                                  if (valid8) {
                                                    if (data19.page !== void 0) {
                                                      let data40 = data19.page;
                                                      const _errs84 = errors2;
                                                      if (errors2 === _errs84) {
                                                        if (data40 && typeof data40 == "object" && !Array.isArray(data40)) {
                                                          let missing6;
                                                          if (data40.offset === void 0 && (missing6 = "offset") || data40.endOffset === void 0 && (missing6 = "endOffset") || data40.totalCharacters === void 0 && (missing6 = "totalCharacters") || data40.textSha256 === void 0 && (missing6 = "textSha256") || data40.pageComplete === void 0 && (missing6 = "pageComplete") || data40.contentComplete === void 0 && (missing6 = "contentComplete") || data40.paginationComplete === void 0 && (missing6 = "paginationComplete") || data40.truncated === void 0 && (missing6 = "truncated")) {
                                                            validate33.errors = [{ instancePath: instancePath + "/data/page", schemaPath: "#/$defs/NativeBillTextSource/properties/page/required", keyword: "required", params: { missingProperty: missing6 }, message: "must have required property '" + missing6 + "'" }];
                                                            return false;
                                                          } else {
                                                            const _errs86 = errors2;
                                                            for (const key6 in data40) {
                                                              if (!(key6 === "offset" || key6 === "endOffset" || key6 === "totalCharacters" || key6 === "textSha256" || key6 === "pageComplete" || key6 === "contentComplete" || key6 === "paginationComplete" || key6 === "truncated")) {
                                                                validate33.errors = [{ instancePath: instancePath + "/data/page", schemaPath: "#/$defs/NativeBillTextSource/properties/page/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key6 }, message: "must NOT have additional properties" }];
                                                                return false;
                                                                break;
                                                              }
                                                            }
                                                            if (_errs86 === errors2) {
                                                              if (data40.offset !== void 0) {
                                                                let data41 = data40.offset;
                                                                const _errs87 = errors2;
                                                                if (!(typeof data41 == "number" && (!(data41 % 1) && !isNaN(data41)) && isFinite(data41))) {
                                                                  validate33.errors = [{ instancePath: instancePath + "/data/page/offset", schemaPath: "#/$defs/NativeBillTextSource/properties/page/properties/offset/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                  return false;
                                                                }
                                                                if (errors2 === _errs87) {
                                                                  if (typeof data41 == "number" && isFinite(data41)) {
                                                                    if (data41 > 3e7 || isNaN(data41)) {
                                                                      validate33.errors = [{ instancePath: instancePath + "/data/page/offset", schemaPath: "#/$defs/NativeBillTextSource/properties/page/properties/offset/maximum", keyword: "maximum", params: { comparison: "<=", limit: 3e7 }, message: "must be <= 30000000" }];
                                                                      return false;
                                                                    } else {
                                                                      if (data41 < 0 || isNaN(data41)) {
                                                                        validate33.errors = [{ instancePath: instancePath + "/data/page/offset", schemaPath: "#/$defs/NativeBillTextSource/properties/page/properties/offset/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                        return false;
                                                                      }
                                                                    }
                                                                  }
                                                                }
                                                                var valid11 = _errs87 === errors2;
                                                              } else {
                                                                var valid11 = true;
                                                              }
                                                              if (valid11) {
                                                                if (data40.endOffset !== void 0) {
                                                                  let data42 = data40.endOffset;
                                                                  const _errs89 = errors2;
                                                                  if (!(typeof data42 == "number" && (!(data42 % 1) && !isNaN(data42)) && isFinite(data42))) {
                                                                    validate33.errors = [{ instancePath: instancePath + "/data/page/endOffset", schemaPath: "#/$defs/NativeBillTextSource/properties/page/properties/endOffset/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                    return false;
                                                                  }
                                                                  if (errors2 === _errs89) {
                                                                    if (typeof data42 == "number" && isFinite(data42)) {
                                                                      if (data42 > 3e7 || isNaN(data42)) {
                                                                        validate33.errors = [{ instancePath: instancePath + "/data/page/endOffset", schemaPath: "#/$defs/NativeBillTextSource/properties/page/properties/endOffset/maximum", keyword: "maximum", params: { comparison: "<=", limit: 3e7 }, message: "must be <= 30000000" }];
                                                                        return false;
                                                                      } else {
                                                                        if (data42 < 0 || isNaN(data42)) {
                                                                          validate33.errors = [{ instancePath: instancePath + "/data/page/endOffset", schemaPath: "#/$defs/NativeBillTextSource/properties/page/properties/endOffset/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                          return false;
                                                                        }
                                                                      }
                                                                    }
                                                                  }
                                                                  var valid11 = _errs89 === errors2;
                                                                } else {
                                                                  var valid11 = true;
                                                                }
                                                                if (valid11) {
                                                                  if (data40.totalCharacters !== void 0) {
                                                                    let data43 = data40.totalCharacters;
                                                                    const _errs91 = errors2;
                                                                    if (!(typeof data43 == "number" && (!(data43 % 1) && !isNaN(data43)) && isFinite(data43))) {
                                                                      validate33.errors = [{ instancePath: instancePath + "/data/page/totalCharacters", schemaPath: "#/$defs/NativeBillTextSource/properties/page/properties/totalCharacters/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                      return false;
                                                                    }
                                                                    if (errors2 === _errs91) {
                                                                      if (typeof data43 == "number" && isFinite(data43)) {
                                                                        if (data43 > 3e7 || isNaN(data43)) {
                                                                          validate33.errors = [{ instancePath: instancePath + "/data/page/totalCharacters", schemaPath: "#/$defs/NativeBillTextSource/properties/page/properties/totalCharacters/maximum", keyword: "maximum", params: { comparison: "<=", limit: 3e7 }, message: "must be <= 30000000" }];
                                                                          return false;
                                                                        } else {
                                                                          if (data43 < 0 || isNaN(data43)) {
                                                                            validate33.errors = [{ instancePath: instancePath + "/data/page/totalCharacters", schemaPath: "#/$defs/NativeBillTextSource/properties/page/properties/totalCharacters/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                            return false;
                                                                          }
                                                                        }
                                                                      }
                                                                    }
                                                                    var valid11 = _errs91 === errors2;
                                                                  } else {
                                                                    var valid11 = true;
                                                                  }
                                                                  if (valid11) {
                                                                    if (data40.textSha256 !== void 0) {
                                                                      let data44 = data40.textSha256;
                                                                      const _errs93 = errors2;
                                                                      if (errors2 === _errs93) {
                                                                        if (typeof data44 === "string") {
                                                                          if (!pattern9.test(data44)) {
                                                                            validate33.errors = [{ instancePath: instancePath + "/data/page/textSha256", schemaPath: "#/$defs/NativeBillTextSource/properties/page/properties/textSha256/pattern", keyword: "pattern", params: { pattern: "^[a-f0-9]{64}$" }, message: 'must match pattern "^[a-f0-9]{64}$"' }];
                                                                            return false;
                                                                          }
                                                                        } else {
                                                                          validate33.errors = [{ instancePath: instancePath + "/data/page/textSha256", schemaPath: "#/$defs/NativeBillTextSource/properties/page/properties/textSha256/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                          return false;
                                                                        }
                                                                      }
                                                                      var valid11 = _errs93 === errors2;
                                                                    } else {
                                                                      var valid11 = true;
                                                                    }
                                                                    if (valid11) {
                                                                      if (data40.pageComplete !== void 0) {
                                                                        const _errs95 = errors2;
                                                                        if (true !== data40.pageComplete) {
                                                                          validate33.errors = [{ instancePath: instancePath + "/data/page/pageComplete", schemaPath: "#/$defs/NativeBillTextSource/properties/page/properties/pageComplete/const", keyword: "const", params: { allowedValue: true }, message: "must be equal to constant" }];
                                                                          return false;
                                                                        }
                                                                        var valid11 = _errs95 === errors2;
                                                                      } else {
                                                                        var valid11 = true;
                                                                      }
                                                                      if (valid11) {
                                                                        if (data40.contentComplete !== void 0) {
                                                                          const _errs96 = errors2;
                                                                          if (typeof data40.contentComplete !== "boolean") {
                                                                            validate33.errors = [{ instancePath: instancePath + "/data/page/contentComplete", schemaPath: "#/$defs/NativeBillTextSource/properties/page/properties/contentComplete/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                                                                            return false;
                                                                          }
                                                                          var valid11 = _errs96 === errors2;
                                                                        } else {
                                                                          var valid11 = true;
                                                                        }
                                                                        if (valid11) {
                                                                          if (data40.paginationComplete !== void 0) {
                                                                            const _errs98 = errors2;
                                                                            if (typeof data40.paginationComplete !== "boolean") {
                                                                              validate33.errors = [{ instancePath: instancePath + "/data/page/paginationComplete", schemaPath: "#/$defs/NativeBillTextSource/properties/page/properties/paginationComplete/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                                                                              return false;
                                                                            }
                                                                            var valid11 = _errs98 === errors2;
                                                                          } else {
                                                                            var valid11 = true;
                                                                          }
                                                                          if (valid11) {
                                                                            if (data40.truncated !== void 0) {
                                                                              const _errs100 = errors2;
                                                                              if (typeof data40.truncated !== "boolean") {
                                                                                validate33.errors = [{ instancePath: instancePath + "/data/page/truncated", schemaPath: "#/$defs/NativeBillTextSource/properties/page/properties/truncated/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                                                                                return false;
                                                                              }
                                                                              var valid11 = _errs100 === errors2;
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
                                                          validate33.errors = [{ instancePath: instancePath + "/data/page", schemaPath: "#/$defs/NativeBillTextSource/properties/page/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                          return false;
                                                        }
                                                      }
                                                      var valid8 = _errs84 === errors2;
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
                              }
                            } else {
                              validate33.errors = [{ instancePath: instancePath + "/data", schemaPath: "#/$defs/NativeBillTextSource/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                              return false;
                            }
                          }
                          var valid0 = _errs42 === errors2;
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
      validate33.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate33.errors = vErrors;
  return errors2 === 0;
}
validate33.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

// conversation-history/protocol.mjs
var freeze = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
var conversationHistoryVersion = "1.1.0";
var HISTORY_PATHS = freeze({ list: "/api/conversations/list", transcript: "/api/conversations/transcript", nextTurn: "/api/conversations/next-turn", summaries: "/api/conversations/summaries", manage: "/api/conversations/manage" });
var historyDomainErrorStatuses = freeze({ CONVERSATION_REQUEST_INVALID: 400, CONVERSATION_CURSOR_INVALID: 400, CONVERSATION_NOT_FOUND: 404, CONVERSATION_TURN_CONFLICT: 409, CONVERSATION_MANAGEMENT_CONFLICT: 409, CONVERSATION_RESTORE_EXPIRED: 410, CONVERSATION_STORE_CORRUPT: 500, CONVERSATION_TURN_UNAVAILABLE: 503, CONVERSATION_UNAVAILABLE: 503 });
var historyErrorStatuses = freeze({ INVALID_REQUEST: [400], UNAUTHENTICATED: [401], ACCESS_DENIED: [403], MEMBERSHIP_REVOKED: [403], NOT_FOUND: [404], METHOD_NOT_ALLOWED: [405], DEADLINE: [408], MEMBERSHIP_CHANGED: [409], REQUEST_TOO_LARGE: [413], UNSUPPORTED_MEDIA_TYPE: [415], CANCELLED: [499], PRODUCT_UNAVAILABLE: [502], ...Object.fromEntries(Object.entries(historyDomainErrorStatuses).map(([code, status]) => [code, [status]])) });
var conversationHistoryMetadata = freeze({
  packageVersion: "0.1.15",
  historyVersion: conversationHistoryVersion,
  schemaId: "urn:meri:conversation-history:1.1.0",
  routes: Object.fromEntries(Object.entries(HISTORY_PATHS).map(([route, path]) => [route, { method: "POST", path }])),
  authentication: { owner: "native identity and current Core membership", header: "authorization", scheme: "Bearer", serverSideCredentialOnly: true, validationGrantsAuthority: false },
  limits: { requestBytes: 131072, responseBytes: 2097152, pageItems: 100 },
  defaults: { limit: 50, after: 0, before: null },
  cursor: { transcript: "conversation sequence", runLocal: "UIEvent.sequence", translation: "conversation sequence = sequenceBase + UIEvent.sequence" },
  promptIdentity: "conversationId + promptLineage.logicalRequestId",
  turnRecovery: "same sourceRunId returns same targetBinding; retain exact submit requestId/prompt",
  errorOutcomes: ["NOT_DISPATCHED", "UNKNOWN", "RESULT_NOT_RELEASED"],
  errorStatuses: historyErrorStatuses
});

// conversation-sources/semantics.mjs
var BILL_TEXT_SOURCE_EVENT = "source.native-bill-text";
var BillTextSourceResponseError = class extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
};
var fail2 = (code) => {
  throw new BillTextSourceResponseError(code);
};
function safeSourceLocator(value) {
  if (typeof value !== "string" || value.length > 4096 || /[\u0000-\u0020\u007f\\]/u.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && url.hostname && url.href.length <= 4096 ? url.href : null;
  } catch {
    return null;
  }
}
function assertNativeSourceEventSemantics(event) {
  if (event.type !== BILL_TEXT_SOURCE_EVENT) fail2("INVALID_SOURCE_EVENT");
  const { page, policyRevision } = event.data, { offset: offset2, endOffset, totalCharacters } = page;
  if (event.scopes.some((s) => s.tenantId !== event.binding.tenantId || s.policyRevision !== policyRevision) || offset2 > endOffset || endOffset > totalCharacters || endOffset - offset2 > 9e3 || page.contentComplete !== (offset2 === 0 && endOffset === totalCharacters) || page.paginationComplete !== (endOffset === totalCharacters) || page.truncated !== (offset2 > 0 || endOffset < totalCharacters)) fail2("INVALID_SOURCE_EVENT");
  return event;
}
function assertSourceReadSemantics(response, request) {
  const event = assertNativeSourceEventSemantics(response.event), page = event.data.page, current = response.current, c = current.coverage;
  if (event.eventId !== request.referenceId || event.binding.conversationId !== request.conversationId || event.binding.runId !== request.runId) fail2("SOURCE_REQUEST_MISMATCH");
  if (c.locator.offset !== page.offset || c.locator.endOffset !== page.endOffset || c.totalCharacters !== page.totalCharacters || current.text.length !== page.endOffset - page.offset || ["pageComplete", "contentComplete", "paginationComplete", "truncated"].some((k) => c[k] !== page[k]) || c.complete !== true) fail2("SOURCE_PAGE_MISMATCH");
  if (current.linkStatus === "available" ? current.sourceLocator === null || safeSourceLocator(current.sourceLocator) !== current.sourceLocator : current.sourceLocator !== null) fail2("UNSAFE_SOURCE_URL");
  return response;
}

// conversation-sources/protocol.mjs
var BILL_TEXT_SOURCE_SCHEMA = "meri.native-bill-text-source/1";
var BILL_TEXT_SOURCE_READ_SCHEMA = "meri.bill-text-source-read/1";
var BILL_TEXT_SOURCE_PATH = "/api/conversations/source-read";
var billTextSourceErrors = Object.freeze({ ...historyErrorStatuses, SOURCE_REFERENCE_NOT_FOUND: Object.freeze([404]), SOURCE_REFERENCE_STALE: Object.freeze([409]), SOURCE_REFERENCE_UNAVAILABLE: Object.freeze([503]), SOURCE_REQUEST_INVALID: Object.freeze([400]) });
var billTextSourceMetadata = Object.freeze({
  version: "1.0.0",
  packageVersion: "0.1.15",
  path: BILL_TEXT_SOURCE_PATH,
  method: "POST",
  requestBytes: 4096,
  responseBytes: 131072,
  authentication: "current native product bearer and Core access",
  authority: false,
  claimMapping: false,
  offsetUnit: "UTF-16 code units",
  scope: "successful sequential read_bill_text@0.2.0 pages only"
});

// conversation-sources/conversation-sources-receiver.mjs
var admitted = /* @__PURE__ */ new WeakMap();
var parse = (bytes, cap) => {
  try {
    return parseBytes(bytes, cap);
  } catch (error) {
    fail2(error.code ?? "INVALID_BYTES");
  }
};
function receiveBillTextSourceRequest(bytes) {
  const value = parse(bytes, billTextSourceMetadata.requestBytes);
  if (!validateRequest(value)) fail2("SOURCE_REQUEST_INVALID");
  admitted.set(value, structuredClone(value));
  return value;
}
function receiveNativeBillTextSourceEvent(bytes) {
  const value = parse(bytes, billTextSourceMetadata.responseBytes);
  if (!validateEvent(value)) fail2("INVALID_SOURCE_EVENT");
  return assertNativeSourceEventSemantics(value);
}
async function receiveBillTextSourceResponse(status, bytes, request) {
  const expected = admitted.get(request);
  if (!expected) fail2("UNADMITTED_REQUEST");
  const value = parse(bytes, billTextSourceMetadata.responseBytes);
  if (status !== 200) {
    if (!Number.isInteger(status) || !value || Object.keys(value).length !== 1 || !value.error || Object.keys(value.error).length !== 1 || typeof value.error.code !== "string" || !Object.hasOwn(billTextSourceErrors, value.error.code) || !billTextSourceErrors[value.error.code].includes(status)) fail2("INVALID_ERROR_RESPONSE");
    return value;
  }
  if (!validateResponse(value)) fail2("INVALID_RESPONSE");
  assertSourceReadSemantics(value, expected);
  const hash = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value.current.text));
  if (Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("") !== value.event.data.page.textSha256) fail2("SOURCE_PAGE_MISMATCH");
  return value;
}
export {
  BILL_TEXT_SOURCE_EVENT,
  BILL_TEXT_SOURCE_PATH,
  BILL_TEXT_SOURCE_READ_SCHEMA,
  BILL_TEXT_SOURCE_SCHEMA,
  BillTextSourceResponseError,
  billTextSourceErrors,
  billTextSourceMetadata,
  receiveBillTextSourceRequest,
  receiveBillTextSourceResponse,
  receiveNativeBillTextSourceEvent
};
