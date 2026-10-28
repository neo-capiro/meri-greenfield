// Generated browser recorded usage boundary.
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

// overview-generated:./generated-overview-validator.mjs
var validateOverviewRequest = validate26;
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
      if (data.schemaVersion === void 0 && (missing0 = "schemaVersion")) {
        validate26.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "schemaVersion")) {
            validate26.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.schemaVersion !== void 0) {
            if ("meri.usage-overview/1" !== data.schemaVersion) {
              validate26.errors = [{ instancePath: instancePath + "/schemaVersion", schemaPath: "#/properties/schemaVersion/const", keyword: "const", params: { allowedValue: "meri.usage-overview/1" }, message: "must be equal to constant" }];
              return false;
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
var validateOverviewResponse = validate27;
var schema35 = { "type": "object", "properties": { "schemaVersion": { "const": "meri.usage-overview/1" }, "observedAt": { "type": "string", "format": "date-time", "pattern": "Z$" }, "timezone": { "const": "UTC" }, "policy": { "oneOf": [{ "type": "object", "properties": { "status": { "const": "configured" }, "revision": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 }, "monthlyCapMicroUsd": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 }, "maxTurns": { "type": "integer", "minimum": 1, "maximum": 100 }, "maxBudgetMicroUsd": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 } }, "required": ["status", "revision", "monthlyCapMicroUsd", "maxTurns", "maxBudgetMicroUsd"], "additionalProperties": false }, { "type": "object", "properties": { "status": { "const": "unavailable" }, "revision": { "type": "null" }, "monthlyCapMicroUsd": { "type": "null" }, "maxTurns": { "type": "null" }, "maxBudgetMicroUsd": { "type": "null" } }, "required": ["status", "revision", "monthlyCapMicroUsd", "maxTurns", "maxBudgetMicroUsd"], "additionalProperties": false }] }, "periods": { "type": "array", "items": { "type": "object", "properties": { "kind": { "enum": ["day", "week", "month"] }, "startInclusive": { "type": "string", "format": "date-time", "pattern": "Z$" }, "endExclusive": { "type": "string", "format": "date-time", "pattern": "Z$" }, "attempts": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "states": { "type": "object", "properties": { "queued": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "starting": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "running": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "waiting-for-approval": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "paused": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "completed": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "failed": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "cancelled": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 } }, "required": ["queued", "starting", "running", "waiting-for-approval", "paused", "completed", "failed", "cancelled"], "additionalProperties": false }, "recording": { "type": "object", "properties": { "recorded": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "unavailable": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "notRecorded": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 } }, "required": ["recorded", "unavailable", "notRecorded"], "additionalProperties": false }, "knownChargeMicroUsd": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "completedAttemptsWithRecordedUsage": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "completedAttemptKnownChargeMicroUsd": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 } }, "required": ["kind", "startInclusive", "endExclusive", "attempts", "states", "recording", "knownChargeMicroUsd", "completedAttemptsWithRecordedUsage", "completedAttemptKnownChargeMicroUsd"], "additionalProperties": false }, "minItems": 3, "maxItems": 3 }, "monthlyAdmission": { "type": "object", "properties": { "startInclusive": { "type": "string", "format": "date-time", "pattern": "Z$" }, "knownChargeMicroUsd": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "unavailableRecordedAttempts": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "remainingKnownMicroUsd": { "anyOf": [{ "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, { "type": "null" }] }, "reached": { "anyOf": [{ "type": "boolean" }, { "type": "null" }] } }, "required": ["startInclusive", "knownChargeMicroUsd", "unavailableRecordedAttempts", "remainingKnownMicroUsd", "reached"], "additionalProperties": false }, "queue": { "type": "object", "properties": { "basis": { "const": "recorded-run-state" }, "states": { "type": "object", "properties": { "queued": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "starting": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "running": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "waiting-for-approval": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "paused": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "completed": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "failed": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "cancelled": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 } }, "required": ["queued", "starting", "running", "waiting-for-approval", "paused", "completed", "failed", "cancelled"], "additionalProperties": false }, "physicalConcurrency": { "type": "null" }, "availableCapacity": { "type": "null" }, "capacityStatus": { "const": "unavailable" } }, "required": ["basis", "states", "physicalConcurrency", "availableCapacity", "capacityStatus"], "additionalProperties": false }, "coverage": { "type": "object", "properties": { "attemptPeriodBasis": { "const": "run-created-at" }, "admissionPeriodBasis": { "const": "sdk-usage-recorded-at" }, "chargeBasis": { "const": "recorded-sdk-estimate" }, "providerBilledMicroUsd": { "type": "null" }, "completeJobCost": { "const": "unavailable" } }, "required": ["attemptPeriodBasis", "admissionPeriodBasis", "chargeBasis", "providerBilledMicroUsd", "completeJobCost"], "additionalProperties": false } }, "required": ["schemaVersion", "observedAt", "timezone", "policy", "periods", "monthlyAdmission", "queue", "coverage"], "additionalProperties": false };
var formats0 = require_formats().fullFormats["date-time"];
var pattern4 = new RegExp("Z$", "u");
var func1 = Object.prototype.hasOwnProperty;
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
      if (data.schemaVersion === void 0 && (missing0 = "schemaVersion") || data.observedAt === void 0 && (missing0 = "observedAt") || data.timezone === void 0 && (missing0 = "timezone") || data.policy === void 0 && (missing0 = "policy") || data.periods === void 0 && (missing0 = "periods") || data.monthlyAdmission === void 0 && (missing0 = "monthlyAdmission") || data.queue === void 0 && (missing0 = "queue") || data.coverage === void 0 && (missing0 = "coverage")) {
        validate27.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "schemaVersion" || key0 === "observedAt" || key0 === "timezone" || key0 === "policy" || key0 === "periods" || key0 === "monthlyAdmission" || key0 === "queue" || key0 === "coverage")) {
            validate27.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.schemaVersion !== void 0) {
            const _errs2 = errors2;
            if ("meri.usage-overview/1" !== data.schemaVersion) {
              validate27.errors = [{ instancePath: instancePath + "/schemaVersion", schemaPath: "#/properties/schemaVersion/const", keyword: "const", params: { allowedValue: "meri.usage-overview/1" }, message: "must be equal to constant" }];
              return false;
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.observedAt !== void 0) {
              let data1 = data.observedAt;
              const _errs3 = errors2;
              if (errors2 === _errs3) {
                if (errors2 === _errs3) {
                  if (typeof data1 === "string") {
                    if (!pattern4.test(data1)) {
                      validate27.errors = [{ instancePath: instancePath + "/observedAt", schemaPath: "#/properties/observedAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                      return false;
                    } else {
                      if (!formats0.validate(data1)) {
                        validate27.errors = [{ instancePath: instancePath + "/observedAt", schemaPath: "#/properties/observedAt/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                        return false;
                      }
                    }
                  } else {
                    validate27.errors = [{ instancePath: instancePath + "/observedAt", schemaPath: "#/properties/observedAt/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
                  }
                }
              }
              var valid0 = _errs3 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.timezone !== void 0) {
                const _errs5 = errors2;
                if ("UTC" !== data.timezone) {
                  validate27.errors = [{ instancePath: instancePath + "/timezone", schemaPath: "#/properties/timezone/const", keyword: "const", params: { allowedValue: "UTC" }, message: "must be equal to constant" }];
                  return false;
                }
                var valid0 = _errs5 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.policy !== void 0) {
                  let data3 = data.policy;
                  const _errs6 = errors2;
                  const _errs7 = errors2;
                  let valid1 = false;
                  let passing0 = null;
                  const _errs8 = errors2;
                  if (errors2 === _errs8) {
                    if (data3 && typeof data3 == "object" && !Array.isArray(data3)) {
                      let missing1;
                      if (data3.status === void 0 && (missing1 = "status") || data3.revision === void 0 && (missing1 = "revision") || data3.monthlyCapMicroUsd === void 0 && (missing1 = "monthlyCapMicroUsd") || data3.maxTurns === void 0 && (missing1 = "maxTurns") || data3.maxBudgetMicroUsd === void 0 && (missing1 = "maxBudgetMicroUsd")) {
                        const err0 = { instancePath: instancePath + "/policy", schemaPath: "#/properties/policy/oneOf/0/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" };
                        if (vErrors === null) {
                          vErrors = [err0];
                        } else {
                          vErrors.push(err0);
                        }
                        errors2++;
                      } else {
                        const _errs10 = errors2;
                        for (const key1 in data3) {
                          if (!(key1 === "status" || key1 === "revision" || key1 === "monthlyCapMicroUsd" || key1 === "maxTurns" || key1 === "maxBudgetMicroUsd")) {
                            const err1 = { instancePath: instancePath + "/policy", schemaPath: "#/properties/policy/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
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
                          if (data3.status !== void 0) {
                            const _errs11 = errors2;
                            if ("configured" !== data3.status) {
                              const err2 = { instancePath: instancePath + "/policy/status", schemaPath: "#/properties/policy/oneOf/0/properties/status/const", keyword: "const", params: { allowedValue: "configured" }, message: "must be equal to constant" };
                              if (vErrors === null) {
                                vErrors = [err2];
                              } else {
                                vErrors.push(err2);
                              }
                              errors2++;
                            }
                            var valid2 = _errs11 === errors2;
                          } else {
                            var valid2 = true;
                          }
                          if (valid2) {
                            if (data3.revision !== void 0) {
                              let data5 = data3.revision;
                              const _errs12 = errors2;
                              if (!(typeof data5 == "number" && (!(data5 % 1) && !isNaN(data5)) && isFinite(data5))) {
                                const err3 = { instancePath: instancePath + "/policy/revision", schemaPath: "#/properties/policy/oneOf/0/properties/revision/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                if (vErrors === null) {
                                  vErrors = [err3];
                                } else {
                                  vErrors.push(err3);
                                }
                                errors2++;
                              }
                              if (errors2 === _errs12) {
                                if (typeof data5 == "number" && isFinite(data5)) {
                                  if (data5 > 9007199254740991 || isNaN(data5)) {
                                    const err4 = { instancePath: instancePath + "/policy/revision", schemaPath: "#/properties/policy/oneOf/0/properties/revision/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                    if (vErrors === null) {
                                      vErrors = [err4];
                                    } else {
                                      vErrors.push(err4);
                                    }
                                    errors2++;
                                  } else {
                                    if (data5 < 1 || isNaN(data5)) {
                                      const err5 = { instancePath: instancePath + "/policy/revision", schemaPath: "#/properties/policy/oneOf/0/properties/revision/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                                      if (vErrors === null) {
                                        vErrors = [err5];
                                      } else {
                                        vErrors.push(err5);
                                      }
                                      errors2++;
                                    }
                                  }
                                }
                              }
                              var valid2 = _errs12 === errors2;
                            } else {
                              var valid2 = true;
                            }
                            if (valid2) {
                              if (data3.monthlyCapMicroUsd !== void 0) {
                                let data6 = data3.monthlyCapMicroUsd;
                                const _errs14 = errors2;
                                if (!(typeof data6 == "number" && (!(data6 % 1) && !isNaN(data6)) && isFinite(data6))) {
                                  const err6 = { instancePath: instancePath + "/policy/monthlyCapMicroUsd", schemaPath: "#/properties/policy/oneOf/0/properties/monthlyCapMicroUsd/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                  if (vErrors === null) {
                                    vErrors = [err6];
                                  } else {
                                    vErrors.push(err6);
                                  }
                                  errors2++;
                                }
                                if (errors2 === _errs14) {
                                  if (typeof data6 == "number" && isFinite(data6)) {
                                    if (data6 > 9007199254740991 || isNaN(data6)) {
                                      const err7 = { instancePath: instancePath + "/policy/monthlyCapMicroUsd", schemaPath: "#/properties/policy/oneOf/0/properties/monthlyCapMicroUsd/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                      if (vErrors === null) {
                                        vErrors = [err7];
                                      } else {
                                        vErrors.push(err7);
                                      }
                                      errors2++;
                                    } else {
                                      if (data6 < 1 || isNaN(data6)) {
                                        const err8 = { instancePath: instancePath + "/policy/monthlyCapMicroUsd", schemaPath: "#/properties/policy/oneOf/0/properties/monthlyCapMicroUsd/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
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
                                var valid2 = _errs14 === errors2;
                              } else {
                                var valid2 = true;
                              }
                              if (valid2) {
                                if (data3.maxTurns !== void 0) {
                                  let data7 = data3.maxTurns;
                                  const _errs16 = errors2;
                                  if (!(typeof data7 == "number" && (!(data7 % 1) && !isNaN(data7)) && isFinite(data7))) {
                                    const err9 = { instancePath: instancePath + "/policy/maxTurns", schemaPath: "#/properties/policy/oneOf/0/properties/maxTurns/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                    if (vErrors === null) {
                                      vErrors = [err9];
                                    } else {
                                      vErrors.push(err9);
                                    }
                                    errors2++;
                                  }
                                  if (errors2 === _errs16) {
                                    if (typeof data7 == "number" && isFinite(data7)) {
                                      if (data7 > 100 || isNaN(data7)) {
                                        const err10 = { instancePath: instancePath + "/policy/maxTurns", schemaPath: "#/properties/policy/oneOf/0/properties/maxTurns/maximum", keyword: "maximum", params: { comparison: "<=", limit: 100 }, message: "must be <= 100" };
                                        if (vErrors === null) {
                                          vErrors = [err10];
                                        } else {
                                          vErrors.push(err10);
                                        }
                                        errors2++;
                                      } else {
                                        if (data7 < 1 || isNaN(data7)) {
                                          const err11 = { instancePath: instancePath + "/policy/maxTurns", schemaPath: "#/properties/policy/oneOf/0/properties/maxTurns/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                                          if (vErrors === null) {
                                            vErrors = [err11];
                                          } else {
                                            vErrors.push(err11);
                                          }
                                          errors2++;
                                        }
                                      }
                                    }
                                  }
                                  var valid2 = _errs16 === errors2;
                                } else {
                                  var valid2 = true;
                                }
                                if (valid2) {
                                  if (data3.maxBudgetMicroUsd !== void 0) {
                                    let data8 = data3.maxBudgetMicroUsd;
                                    const _errs18 = errors2;
                                    if (!(typeof data8 == "number" && (!(data8 % 1) && !isNaN(data8)) && isFinite(data8))) {
                                      const err12 = { instancePath: instancePath + "/policy/maxBudgetMicroUsd", schemaPath: "#/properties/policy/oneOf/0/properties/maxBudgetMicroUsd/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                      if (vErrors === null) {
                                        vErrors = [err12];
                                      } else {
                                        vErrors.push(err12);
                                      }
                                      errors2++;
                                    }
                                    if (errors2 === _errs18) {
                                      if (typeof data8 == "number" && isFinite(data8)) {
                                        if (data8 > 9007199254740991 || isNaN(data8)) {
                                          const err13 = { instancePath: instancePath + "/policy/maxBudgetMicroUsd", schemaPath: "#/properties/policy/oneOf/0/properties/maxBudgetMicroUsd/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                          if (vErrors === null) {
                                            vErrors = [err13];
                                          } else {
                                            vErrors.push(err13);
                                          }
                                          errors2++;
                                        } else {
                                          if (data8 < 1 || isNaN(data8)) {
                                            const err14 = { instancePath: instancePath + "/policy/maxBudgetMicroUsd", schemaPath: "#/properties/policy/oneOf/0/properties/maxBudgetMicroUsd/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                                            if (vErrors === null) {
                                              vErrors = [err14];
                                            } else {
                                              vErrors.push(err14);
                                            }
                                            errors2++;
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
                    } else {
                      const err15 = { instancePath: instancePath + "/policy", schemaPath: "#/properties/policy/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                      if (vErrors === null) {
                        vErrors = [err15];
                      } else {
                        vErrors.push(err15);
                      }
                      errors2++;
                    }
                  }
                  var _valid0 = _errs8 === errors2;
                  if (_valid0) {
                    valid1 = true;
                    passing0 = 0;
                    var props0 = true;
                  }
                  const _errs20 = errors2;
                  if (errors2 === _errs20) {
                    if (data3 && typeof data3 == "object" && !Array.isArray(data3)) {
                      let missing2;
                      if (data3.status === void 0 && (missing2 = "status") || data3.revision === void 0 && (missing2 = "revision") || data3.monthlyCapMicroUsd === void 0 && (missing2 = "monthlyCapMicroUsd") || data3.maxTurns === void 0 && (missing2 = "maxTurns") || data3.maxBudgetMicroUsd === void 0 && (missing2 = "maxBudgetMicroUsd")) {
                        const err16 = { instancePath: instancePath + "/policy", schemaPath: "#/properties/policy/oneOf/1/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" };
                        if (vErrors === null) {
                          vErrors = [err16];
                        } else {
                          vErrors.push(err16);
                        }
                        errors2++;
                      } else {
                        const _errs22 = errors2;
                        for (const key2 in data3) {
                          if (!(key2 === "status" || key2 === "revision" || key2 === "monthlyCapMicroUsd" || key2 === "maxTurns" || key2 === "maxBudgetMicroUsd")) {
                            const err17 = { instancePath: instancePath + "/policy", schemaPath: "#/properties/policy/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
                            if (vErrors === null) {
                              vErrors = [err17];
                            } else {
                              vErrors.push(err17);
                            }
                            errors2++;
                            break;
                          }
                        }
                        if (_errs22 === errors2) {
                          if (data3.status !== void 0) {
                            const _errs23 = errors2;
                            if ("unavailable" !== data3.status) {
                              const err18 = { instancePath: instancePath + "/policy/status", schemaPath: "#/properties/policy/oneOf/1/properties/status/const", keyword: "const", params: { allowedValue: "unavailable" }, message: "must be equal to constant" };
                              if (vErrors === null) {
                                vErrors = [err18];
                              } else {
                                vErrors.push(err18);
                              }
                              errors2++;
                            }
                            var valid3 = _errs23 === errors2;
                          } else {
                            var valid3 = true;
                          }
                          if (valid3) {
                            if (data3.revision !== void 0) {
                              const _errs24 = errors2;
                              if (data3.revision !== null) {
                                const err19 = { instancePath: instancePath + "/policy/revision", schemaPath: "#/properties/policy/oneOf/1/properties/revision/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                if (vErrors === null) {
                                  vErrors = [err19];
                                } else {
                                  vErrors.push(err19);
                                }
                                errors2++;
                              }
                              var valid3 = _errs24 === errors2;
                            } else {
                              var valid3 = true;
                            }
                            if (valid3) {
                              if (data3.monthlyCapMicroUsd !== void 0) {
                                const _errs26 = errors2;
                                if (data3.monthlyCapMicroUsd !== null) {
                                  const err20 = { instancePath: instancePath + "/policy/monthlyCapMicroUsd", schemaPath: "#/properties/policy/oneOf/1/properties/monthlyCapMicroUsd/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                  if (vErrors === null) {
                                    vErrors = [err20];
                                  } else {
                                    vErrors.push(err20);
                                  }
                                  errors2++;
                                }
                                var valid3 = _errs26 === errors2;
                              } else {
                                var valid3 = true;
                              }
                              if (valid3) {
                                if (data3.maxTurns !== void 0) {
                                  const _errs28 = errors2;
                                  if (data3.maxTurns !== null) {
                                    const err21 = { instancePath: instancePath + "/policy/maxTurns", schemaPath: "#/properties/policy/oneOf/1/properties/maxTurns/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                    if (vErrors === null) {
                                      vErrors = [err21];
                                    } else {
                                      vErrors.push(err21);
                                    }
                                    errors2++;
                                  }
                                  var valid3 = _errs28 === errors2;
                                } else {
                                  var valid3 = true;
                                }
                                if (valid3) {
                                  if (data3.maxBudgetMicroUsd !== void 0) {
                                    const _errs30 = errors2;
                                    if (data3.maxBudgetMicroUsd !== null) {
                                      const err22 = { instancePath: instancePath + "/policy/maxBudgetMicroUsd", schemaPath: "#/properties/policy/oneOf/1/properties/maxBudgetMicroUsd/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                      if (vErrors === null) {
                                        vErrors = [err22];
                                      } else {
                                        vErrors.push(err22);
                                      }
                                      errors2++;
                                    }
                                    var valid3 = _errs30 === errors2;
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
                      const err23 = { instancePath: instancePath + "/policy", schemaPath: "#/properties/policy/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                      if (vErrors === null) {
                        vErrors = [err23];
                      } else {
                        vErrors.push(err23);
                      }
                      errors2++;
                    }
                  }
                  var _valid0 = _errs20 === errors2;
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
                  }
                  if (!valid1) {
                    const err24 = { instancePath: instancePath + "/policy", schemaPath: "#/properties/policy/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
                    if (vErrors === null) {
                      vErrors = [err24];
                    } else {
                      vErrors.push(err24);
                    }
                    errors2++;
                    validate27.errors = vErrors;
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
                  if (data.periods !== void 0) {
                    let data14 = data.periods;
                    const _errs32 = errors2;
                    if (errors2 === _errs32) {
                      if (Array.isArray(data14)) {
                        if (data14.length > 3) {
                          validate27.errors = [{ instancePath: instancePath + "/periods", schemaPath: "#/properties/periods/maxItems", keyword: "maxItems", params: { limit: 3 }, message: "must NOT have more than 3 items" }];
                          return false;
                        } else {
                          if (data14.length < 3) {
                            validate27.errors = [{ instancePath: instancePath + "/periods", schemaPath: "#/properties/periods/minItems", keyword: "minItems", params: { limit: 3 }, message: "must NOT have fewer than 3 items" }];
                            return false;
                          } else {
                            var valid4 = true;
                            const len0 = data14.length;
                            for (let i0 = 0; i0 < len0; i0++) {
                              let data15 = data14[i0];
                              const _errs34 = errors2;
                              if (errors2 === _errs34) {
                                if (data15 && typeof data15 == "object" && !Array.isArray(data15)) {
                                  let missing3;
                                  if (data15.kind === void 0 && (missing3 = "kind") || data15.startInclusive === void 0 && (missing3 = "startInclusive") || data15.endExclusive === void 0 && (missing3 = "endExclusive") || data15.attempts === void 0 && (missing3 = "attempts") || data15.states === void 0 && (missing3 = "states") || data15.recording === void 0 && (missing3 = "recording") || data15.knownChargeMicroUsd === void 0 && (missing3 = "knownChargeMicroUsd") || data15.completedAttemptsWithRecordedUsage === void 0 && (missing3 = "completedAttemptsWithRecordedUsage") || data15.completedAttemptKnownChargeMicroUsd === void 0 && (missing3 = "completedAttemptKnownChargeMicroUsd")) {
                                    validate27.errors = [{ instancePath: instancePath + "/periods/" + i0, schemaPath: "#/properties/periods/items/required", keyword: "required", params: { missingProperty: missing3 }, message: "must have required property '" + missing3 + "'" }];
                                    return false;
                                  } else {
                                    const _errs36 = errors2;
                                    for (const key3 in data15) {
                                      if (!func1.call(schema35.properties.periods.items.properties, key3)) {
                                        validate27.errors = [{ instancePath: instancePath + "/periods/" + i0, schemaPath: "#/properties/periods/items/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" }];
                                        return false;
                                        break;
                                      }
                                    }
                                    if (_errs36 === errors2) {
                                      if (data15.kind !== void 0) {
                                        let data16 = data15.kind;
                                        const _errs37 = errors2;
                                        if (!(data16 === "day" || data16 === "week" || data16 === "month")) {
                                          validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/kind", schemaPath: "#/properties/periods/items/properties/kind/enum", keyword: "enum", params: { allowedValues: schema35.properties.periods.items.properties.kind.enum }, message: "must be equal to one of the allowed values" }];
                                          return false;
                                        }
                                        var valid5 = _errs37 === errors2;
                                      } else {
                                        var valid5 = true;
                                      }
                                      if (valid5) {
                                        if (data15.startInclusive !== void 0) {
                                          let data17 = data15.startInclusive;
                                          const _errs38 = errors2;
                                          if (errors2 === _errs38) {
                                            if (errors2 === _errs38) {
                                              if (typeof data17 === "string") {
                                                if (!pattern4.test(data17)) {
                                                  validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/startInclusive", schemaPath: "#/properties/periods/items/properties/startInclusive/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                                                  return false;
                                                } else {
                                                  if (!formats0.validate(data17)) {
                                                    validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/startInclusive", schemaPath: "#/properties/periods/items/properties/startInclusive/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                                                    return false;
                                                  }
                                                }
                                              } else {
                                                validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/startInclusive", schemaPath: "#/properties/periods/items/properties/startInclusive/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                return false;
                                              }
                                            }
                                          }
                                          var valid5 = _errs38 === errors2;
                                        } else {
                                          var valid5 = true;
                                        }
                                        if (valid5) {
                                          if (data15.endExclusive !== void 0) {
                                            let data18 = data15.endExclusive;
                                            const _errs40 = errors2;
                                            if (errors2 === _errs40) {
                                              if (errors2 === _errs40) {
                                                if (typeof data18 === "string") {
                                                  if (!pattern4.test(data18)) {
                                                    validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/endExclusive", schemaPath: "#/properties/periods/items/properties/endExclusive/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                                                    return false;
                                                  } else {
                                                    if (!formats0.validate(data18)) {
                                                      validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/endExclusive", schemaPath: "#/properties/periods/items/properties/endExclusive/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                                                      return false;
                                                    }
                                                  }
                                                } else {
                                                  validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/endExclusive", schemaPath: "#/properties/periods/items/properties/endExclusive/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                  return false;
                                                }
                                              }
                                            }
                                            var valid5 = _errs40 === errors2;
                                          } else {
                                            var valid5 = true;
                                          }
                                          if (valid5) {
                                            if (data15.attempts !== void 0) {
                                              let data19 = data15.attempts;
                                              const _errs42 = errors2;
                                              if (!(typeof data19 == "number" && (!(data19 % 1) && !isNaN(data19)) && isFinite(data19))) {
                                                validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/attempts", schemaPath: "#/properties/periods/items/properties/attempts/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                return false;
                                              }
                                              if (errors2 === _errs42) {
                                                if (typeof data19 == "number" && isFinite(data19)) {
                                                  if (data19 > 9007199254740991 || isNaN(data19)) {
                                                    validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/attempts", schemaPath: "#/properties/periods/items/properties/attempts/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                    return false;
                                                  } else {
                                                    if (data19 < 0 || isNaN(data19)) {
                                                      validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/attempts", schemaPath: "#/properties/periods/items/properties/attempts/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                      return false;
                                                    }
                                                  }
                                                }
                                              }
                                              var valid5 = _errs42 === errors2;
                                            } else {
                                              var valid5 = true;
                                            }
                                            if (valid5) {
                                              if (data15.states !== void 0) {
                                                let data20 = data15.states;
                                                const _errs44 = errors2;
                                                if (errors2 === _errs44) {
                                                  if (data20 && typeof data20 == "object" && !Array.isArray(data20)) {
                                                    let missing4;
                                                    if (data20.queued === void 0 && (missing4 = "queued") || data20.starting === void 0 && (missing4 = "starting") || data20.running === void 0 && (missing4 = "running") || data20["waiting-for-approval"] === void 0 && (missing4 = "waiting-for-approval") || data20.paused === void 0 && (missing4 = "paused") || data20.completed === void 0 && (missing4 = "completed") || data20.failed === void 0 && (missing4 = "failed") || data20.cancelled === void 0 && (missing4 = "cancelled")) {
                                                      validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states", schemaPath: "#/properties/periods/items/properties/states/required", keyword: "required", params: { missingProperty: missing4 }, message: "must have required property '" + missing4 + "'" }];
                                                      return false;
                                                    } else {
                                                      const _errs46 = errors2;
                                                      for (const key4 in data20) {
                                                        if (!(key4 === "queued" || key4 === "starting" || key4 === "running" || key4 === "waiting-for-approval" || key4 === "paused" || key4 === "completed" || key4 === "failed" || key4 === "cancelled")) {
                                                          validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states", schemaPath: "#/properties/periods/items/properties/states/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key4 }, message: "must NOT have additional properties" }];
                                                          return false;
                                                          break;
                                                        }
                                                      }
                                                      if (_errs46 === errors2) {
                                                        if (data20.queued !== void 0) {
                                                          let data21 = data20.queued;
                                                          const _errs47 = errors2;
                                                          if (!(typeof data21 == "number" && (!(data21 % 1) && !isNaN(data21)) && isFinite(data21))) {
                                                            validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/queued", schemaPath: "#/properties/periods/items/properties/states/properties/queued/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                            return false;
                                                          }
                                                          if (errors2 === _errs47) {
                                                            if (typeof data21 == "number" && isFinite(data21)) {
                                                              if (data21 > 9007199254740991 || isNaN(data21)) {
                                                                validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/queued", schemaPath: "#/properties/periods/items/properties/states/properties/queued/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                return false;
                                                              } else {
                                                                if (data21 < 0 || isNaN(data21)) {
                                                                  validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/queued", schemaPath: "#/properties/periods/items/properties/states/properties/queued/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                  return false;
                                                                }
                                                              }
                                                            }
                                                          }
                                                          var valid6 = _errs47 === errors2;
                                                        } else {
                                                          var valid6 = true;
                                                        }
                                                        if (valid6) {
                                                          if (data20.starting !== void 0) {
                                                            let data22 = data20.starting;
                                                            const _errs49 = errors2;
                                                            if (!(typeof data22 == "number" && (!(data22 % 1) && !isNaN(data22)) && isFinite(data22))) {
                                                              validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/starting", schemaPath: "#/properties/periods/items/properties/states/properties/starting/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                              return false;
                                                            }
                                                            if (errors2 === _errs49) {
                                                              if (typeof data22 == "number" && isFinite(data22)) {
                                                                if (data22 > 9007199254740991 || isNaN(data22)) {
                                                                  validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/starting", schemaPath: "#/properties/periods/items/properties/states/properties/starting/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                  return false;
                                                                } else {
                                                                  if (data22 < 0 || isNaN(data22)) {
                                                                    validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/starting", schemaPath: "#/properties/periods/items/properties/states/properties/starting/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                    return false;
                                                                  }
                                                                }
                                                              }
                                                            }
                                                            var valid6 = _errs49 === errors2;
                                                          } else {
                                                            var valid6 = true;
                                                          }
                                                          if (valid6) {
                                                            if (data20.running !== void 0) {
                                                              let data23 = data20.running;
                                                              const _errs51 = errors2;
                                                              if (!(typeof data23 == "number" && (!(data23 % 1) && !isNaN(data23)) && isFinite(data23))) {
                                                                validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/running", schemaPath: "#/properties/periods/items/properties/states/properties/running/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                return false;
                                                              }
                                                              if (errors2 === _errs51) {
                                                                if (typeof data23 == "number" && isFinite(data23)) {
                                                                  if (data23 > 9007199254740991 || isNaN(data23)) {
                                                                    validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/running", schemaPath: "#/properties/periods/items/properties/states/properties/running/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                    return false;
                                                                  } else {
                                                                    if (data23 < 0 || isNaN(data23)) {
                                                                      validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/running", schemaPath: "#/properties/periods/items/properties/states/properties/running/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                      return false;
                                                                    }
                                                                  }
                                                                }
                                                              }
                                                              var valid6 = _errs51 === errors2;
                                                            } else {
                                                              var valid6 = true;
                                                            }
                                                            if (valid6) {
                                                              if (data20["waiting-for-approval"] !== void 0) {
                                                                let data24 = data20["waiting-for-approval"];
                                                                const _errs53 = errors2;
                                                                if (!(typeof data24 == "number" && (!(data24 % 1) && !isNaN(data24)) && isFinite(data24))) {
                                                                  validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/waiting-for-approval", schemaPath: "#/properties/periods/items/properties/states/properties/waiting-for-approval/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                  return false;
                                                                }
                                                                if (errors2 === _errs53) {
                                                                  if (typeof data24 == "number" && isFinite(data24)) {
                                                                    if (data24 > 9007199254740991 || isNaN(data24)) {
                                                                      validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/waiting-for-approval", schemaPath: "#/properties/periods/items/properties/states/properties/waiting-for-approval/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                      return false;
                                                                    } else {
                                                                      if (data24 < 0 || isNaN(data24)) {
                                                                        validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/waiting-for-approval", schemaPath: "#/properties/periods/items/properties/states/properties/waiting-for-approval/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                        return false;
                                                                      }
                                                                    }
                                                                  }
                                                                }
                                                                var valid6 = _errs53 === errors2;
                                                              } else {
                                                                var valid6 = true;
                                                              }
                                                              if (valid6) {
                                                                if (data20.paused !== void 0) {
                                                                  let data25 = data20.paused;
                                                                  const _errs55 = errors2;
                                                                  if (!(typeof data25 == "number" && (!(data25 % 1) && !isNaN(data25)) && isFinite(data25))) {
                                                                    validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/paused", schemaPath: "#/properties/periods/items/properties/states/properties/paused/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                    return false;
                                                                  }
                                                                  if (errors2 === _errs55) {
                                                                    if (typeof data25 == "number" && isFinite(data25)) {
                                                                      if (data25 > 9007199254740991 || isNaN(data25)) {
                                                                        validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/paused", schemaPath: "#/properties/periods/items/properties/states/properties/paused/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                        return false;
                                                                      } else {
                                                                        if (data25 < 0 || isNaN(data25)) {
                                                                          validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/paused", schemaPath: "#/properties/periods/items/properties/states/properties/paused/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                          return false;
                                                                        }
                                                                      }
                                                                    }
                                                                  }
                                                                  var valid6 = _errs55 === errors2;
                                                                } else {
                                                                  var valid6 = true;
                                                                }
                                                                if (valid6) {
                                                                  if (data20.completed !== void 0) {
                                                                    let data26 = data20.completed;
                                                                    const _errs57 = errors2;
                                                                    if (!(typeof data26 == "number" && (!(data26 % 1) && !isNaN(data26)) && isFinite(data26))) {
                                                                      validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/completed", schemaPath: "#/properties/periods/items/properties/states/properties/completed/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                      return false;
                                                                    }
                                                                    if (errors2 === _errs57) {
                                                                      if (typeof data26 == "number" && isFinite(data26)) {
                                                                        if (data26 > 9007199254740991 || isNaN(data26)) {
                                                                          validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/completed", schemaPath: "#/properties/periods/items/properties/states/properties/completed/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                          return false;
                                                                        } else {
                                                                          if (data26 < 0 || isNaN(data26)) {
                                                                            validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/completed", schemaPath: "#/properties/periods/items/properties/states/properties/completed/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                            return false;
                                                                          }
                                                                        }
                                                                      }
                                                                    }
                                                                    var valid6 = _errs57 === errors2;
                                                                  } else {
                                                                    var valid6 = true;
                                                                  }
                                                                  if (valid6) {
                                                                    if (data20.failed !== void 0) {
                                                                      let data27 = data20.failed;
                                                                      const _errs59 = errors2;
                                                                      if (!(typeof data27 == "number" && (!(data27 % 1) && !isNaN(data27)) && isFinite(data27))) {
                                                                        validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/failed", schemaPath: "#/properties/periods/items/properties/states/properties/failed/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                        return false;
                                                                      }
                                                                      if (errors2 === _errs59) {
                                                                        if (typeof data27 == "number" && isFinite(data27)) {
                                                                          if (data27 > 9007199254740991 || isNaN(data27)) {
                                                                            validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/failed", schemaPath: "#/properties/periods/items/properties/states/properties/failed/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                            return false;
                                                                          } else {
                                                                            if (data27 < 0 || isNaN(data27)) {
                                                                              validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/failed", schemaPath: "#/properties/periods/items/properties/states/properties/failed/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                              return false;
                                                                            }
                                                                          }
                                                                        }
                                                                      }
                                                                      var valid6 = _errs59 === errors2;
                                                                    } else {
                                                                      var valid6 = true;
                                                                    }
                                                                    if (valid6) {
                                                                      if (data20.cancelled !== void 0) {
                                                                        let data28 = data20.cancelled;
                                                                        const _errs61 = errors2;
                                                                        if (!(typeof data28 == "number" && (!(data28 % 1) && !isNaN(data28)) && isFinite(data28))) {
                                                                          validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/cancelled", schemaPath: "#/properties/periods/items/properties/states/properties/cancelled/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                          return false;
                                                                        }
                                                                        if (errors2 === _errs61) {
                                                                          if (typeof data28 == "number" && isFinite(data28)) {
                                                                            if (data28 > 9007199254740991 || isNaN(data28)) {
                                                                              validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/cancelled", schemaPath: "#/properties/periods/items/properties/states/properties/cancelled/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                              return false;
                                                                            } else {
                                                                              if (data28 < 0 || isNaN(data28)) {
                                                                                validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/cancelled", schemaPath: "#/properties/periods/items/properties/states/properties/cancelled/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                return false;
                                                                              }
                                                                            }
                                                                          }
                                                                        }
                                                                        var valid6 = _errs61 === errors2;
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
                                                    validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states", schemaPath: "#/properties/periods/items/properties/states/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                    return false;
                                                  }
                                                }
                                                var valid5 = _errs44 === errors2;
                                              } else {
                                                var valid5 = true;
                                              }
                                              if (valid5) {
                                                if (data15.recording !== void 0) {
                                                  let data29 = data15.recording;
                                                  const _errs63 = errors2;
                                                  if (errors2 === _errs63) {
                                                    if (data29 && typeof data29 == "object" && !Array.isArray(data29)) {
                                                      let missing5;
                                                      if (data29.recorded === void 0 && (missing5 = "recorded") || data29.unavailable === void 0 && (missing5 = "unavailable") || data29.notRecorded === void 0 && (missing5 = "notRecorded")) {
                                                        validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recording", schemaPath: "#/properties/periods/items/properties/recording/required", keyword: "required", params: { missingProperty: missing5 }, message: "must have required property '" + missing5 + "'" }];
                                                        return false;
                                                      } else {
                                                        const _errs65 = errors2;
                                                        for (const key5 in data29) {
                                                          if (!(key5 === "recorded" || key5 === "unavailable" || key5 === "notRecorded")) {
                                                            validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recording", schemaPath: "#/properties/periods/items/properties/recording/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key5 }, message: "must NOT have additional properties" }];
                                                            return false;
                                                            break;
                                                          }
                                                        }
                                                        if (_errs65 === errors2) {
                                                          if (data29.recorded !== void 0) {
                                                            let data30 = data29.recorded;
                                                            const _errs66 = errors2;
                                                            if (!(typeof data30 == "number" && (!(data30 % 1) && !isNaN(data30)) && isFinite(data30))) {
                                                              validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recording/recorded", schemaPath: "#/properties/periods/items/properties/recording/properties/recorded/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                              return false;
                                                            }
                                                            if (errors2 === _errs66) {
                                                              if (typeof data30 == "number" && isFinite(data30)) {
                                                                if (data30 > 9007199254740991 || isNaN(data30)) {
                                                                  validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recording/recorded", schemaPath: "#/properties/periods/items/properties/recording/properties/recorded/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                  return false;
                                                                } else {
                                                                  if (data30 < 0 || isNaN(data30)) {
                                                                    validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recording/recorded", schemaPath: "#/properties/periods/items/properties/recording/properties/recorded/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                    return false;
                                                                  }
                                                                }
                                                              }
                                                            }
                                                            var valid7 = _errs66 === errors2;
                                                          } else {
                                                            var valid7 = true;
                                                          }
                                                          if (valid7) {
                                                            if (data29.unavailable !== void 0) {
                                                              let data31 = data29.unavailable;
                                                              const _errs68 = errors2;
                                                              if (!(typeof data31 == "number" && (!(data31 % 1) && !isNaN(data31)) && isFinite(data31))) {
                                                                validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recording/unavailable", schemaPath: "#/properties/periods/items/properties/recording/properties/unavailable/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                return false;
                                                              }
                                                              if (errors2 === _errs68) {
                                                                if (typeof data31 == "number" && isFinite(data31)) {
                                                                  if (data31 > 9007199254740991 || isNaN(data31)) {
                                                                    validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recording/unavailable", schemaPath: "#/properties/periods/items/properties/recording/properties/unavailable/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                    return false;
                                                                  } else {
                                                                    if (data31 < 0 || isNaN(data31)) {
                                                                      validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recording/unavailable", schemaPath: "#/properties/periods/items/properties/recording/properties/unavailable/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                      return false;
                                                                    }
                                                                  }
                                                                }
                                                              }
                                                              var valid7 = _errs68 === errors2;
                                                            } else {
                                                              var valid7 = true;
                                                            }
                                                            if (valid7) {
                                                              if (data29.notRecorded !== void 0) {
                                                                let data32 = data29.notRecorded;
                                                                const _errs70 = errors2;
                                                                if (!(typeof data32 == "number" && (!(data32 % 1) && !isNaN(data32)) && isFinite(data32))) {
                                                                  validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recording/notRecorded", schemaPath: "#/properties/periods/items/properties/recording/properties/notRecorded/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                  return false;
                                                                }
                                                                if (errors2 === _errs70) {
                                                                  if (typeof data32 == "number" && isFinite(data32)) {
                                                                    if (data32 > 9007199254740991 || isNaN(data32)) {
                                                                      validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recording/notRecorded", schemaPath: "#/properties/periods/items/properties/recording/properties/notRecorded/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                      return false;
                                                                    } else {
                                                                      if (data32 < 0 || isNaN(data32)) {
                                                                        validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recording/notRecorded", schemaPath: "#/properties/periods/items/properties/recording/properties/notRecorded/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                        return false;
                                                                      }
                                                                    }
                                                                  }
                                                                }
                                                                var valid7 = _errs70 === errors2;
                                                              } else {
                                                                var valid7 = true;
                                                              }
                                                            }
                                                          }
                                                        }
                                                      }
                                                    } else {
                                                      validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recording", schemaPath: "#/properties/periods/items/properties/recording/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                      return false;
                                                    }
                                                  }
                                                  var valid5 = _errs63 === errors2;
                                                } else {
                                                  var valid5 = true;
                                                }
                                                if (valid5) {
                                                  if (data15.knownChargeMicroUsd !== void 0) {
                                                    let data33 = data15.knownChargeMicroUsd;
                                                    const _errs72 = errors2;
                                                    if (!(typeof data33 == "number" && (!(data33 % 1) && !isNaN(data33)) && isFinite(data33))) {
                                                      validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/knownChargeMicroUsd", schemaPath: "#/properties/periods/items/properties/knownChargeMicroUsd/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                      return false;
                                                    }
                                                    if (errors2 === _errs72) {
                                                      if (typeof data33 == "number" && isFinite(data33)) {
                                                        if (data33 > 9007199254740991 || isNaN(data33)) {
                                                          validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/knownChargeMicroUsd", schemaPath: "#/properties/periods/items/properties/knownChargeMicroUsd/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                          return false;
                                                        } else {
                                                          if (data33 < 0 || isNaN(data33)) {
                                                            validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/knownChargeMicroUsd", schemaPath: "#/properties/periods/items/properties/knownChargeMicroUsd/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                            return false;
                                                          }
                                                        }
                                                      }
                                                    }
                                                    var valid5 = _errs72 === errors2;
                                                  } else {
                                                    var valid5 = true;
                                                  }
                                                  if (valid5) {
                                                    if (data15.completedAttemptsWithRecordedUsage !== void 0) {
                                                      let data34 = data15.completedAttemptsWithRecordedUsage;
                                                      const _errs74 = errors2;
                                                      if (!(typeof data34 == "number" && (!(data34 % 1) && !isNaN(data34)) && isFinite(data34))) {
                                                        validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/completedAttemptsWithRecordedUsage", schemaPath: "#/properties/periods/items/properties/completedAttemptsWithRecordedUsage/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                        return false;
                                                      }
                                                      if (errors2 === _errs74) {
                                                        if (typeof data34 == "number" && isFinite(data34)) {
                                                          if (data34 > 9007199254740991 || isNaN(data34)) {
                                                            validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/completedAttemptsWithRecordedUsage", schemaPath: "#/properties/periods/items/properties/completedAttemptsWithRecordedUsage/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                            return false;
                                                          } else {
                                                            if (data34 < 0 || isNaN(data34)) {
                                                              validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/completedAttemptsWithRecordedUsage", schemaPath: "#/properties/periods/items/properties/completedAttemptsWithRecordedUsage/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                              return false;
                                                            }
                                                          }
                                                        }
                                                      }
                                                      var valid5 = _errs74 === errors2;
                                                    } else {
                                                      var valid5 = true;
                                                    }
                                                    if (valid5) {
                                                      if (data15.completedAttemptKnownChargeMicroUsd !== void 0) {
                                                        let data35 = data15.completedAttemptKnownChargeMicroUsd;
                                                        const _errs76 = errors2;
                                                        if (!(typeof data35 == "number" && (!(data35 % 1) && !isNaN(data35)) && isFinite(data35))) {
                                                          validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/completedAttemptKnownChargeMicroUsd", schemaPath: "#/properties/periods/items/properties/completedAttemptKnownChargeMicroUsd/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                          return false;
                                                        }
                                                        if (errors2 === _errs76) {
                                                          if (typeof data35 == "number" && isFinite(data35)) {
                                                            if (data35 > 9007199254740991 || isNaN(data35)) {
                                                              validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/completedAttemptKnownChargeMicroUsd", schemaPath: "#/properties/periods/items/properties/completedAttemptKnownChargeMicroUsd/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                              return false;
                                                            } else {
                                                              if (data35 < 0 || isNaN(data35)) {
                                                                validate27.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/completedAttemptKnownChargeMicroUsd", schemaPath: "#/properties/periods/items/properties/completedAttemptKnownChargeMicroUsd/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                return false;
                                                              }
                                                            }
                                                          }
                                                        }
                                                        var valid5 = _errs76 === errors2;
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
                                  validate27.errors = [{ instancePath: instancePath + "/periods/" + i0, schemaPath: "#/properties/periods/items/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                  return false;
                                }
                              }
                              var valid4 = _errs34 === errors2;
                              if (!valid4) {
                                break;
                              }
                            }
                          }
                        }
                      } else {
                        validate27.errors = [{ instancePath: instancePath + "/periods", schemaPath: "#/properties/periods/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                        return false;
                      }
                    }
                    var valid0 = _errs32 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.monthlyAdmission !== void 0) {
                      let data36 = data.monthlyAdmission;
                      const _errs78 = errors2;
                      if (errors2 === _errs78) {
                        if (data36 && typeof data36 == "object" && !Array.isArray(data36)) {
                          let missing6;
                          if (data36.startInclusive === void 0 && (missing6 = "startInclusive") || data36.knownChargeMicroUsd === void 0 && (missing6 = "knownChargeMicroUsd") || data36.unavailableRecordedAttempts === void 0 && (missing6 = "unavailableRecordedAttempts") || data36.remainingKnownMicroUsd === void 0 && (missing6 = "remainingKnownMicroUsd") || data36.reached === void 0 && (missing6 = "reached")) {
                            validate27.errors = [{ instancePath: instancePath + "/monthlyAdmission", schemaPath: "#/properties/monthlyAdmission/required", keyword: "required", params: { missingProperty: missing6 }, message: "must have required property '" + missing6 + "'" }];
                            return false;
                          } else {
                            const _errs80 = errors2;
                            for (const key6 in data36) {
                              if (!(key6 === "startInclusive" || key6 === "knownChargeMicroUsd" || key6 === "unavailableRecordedAttempts" || key6 === "remainingKnownMicroUsd" || key6 === "reached")) {
                                validate27.errors = [{ instancePath: instancePath + "/monthlyAdmission", schemaPath: "#/properties/monthlyAdmission/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key6 }, message: "must NOT have additional properties" }];
                                return false;
                                break;
                              }
                            }
                            if (_errs80 === errors2) {
                              if (data36.startInclusive !== void 0) {
                                let data37 = data36.startInclusive;
                                const _errs81 = errors2;
                                if (errors2 === _errs81) {
                                  if (errors2 === _errs81) {
                                    if (typeof data37 === "string") {
                                      if (!pattern4.test(data37)) {
                                        validate27.errors = [{ instancePath: instancePath + "/monthlyAdmission/startInclusive", schemaPath: "#/properties/monthlyAdmission/properties/startInclusive/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                                        return false;
                                      } else {
                                        if (!formats0.validate(data37)) {
                                          validate27.errors = [{ instancePath: instancePath + "/monthlyAdmission/startInclusive", schemaPath: "#/properties/monthlyAdmission/properties/startInclusive/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                                          return false;
                                        }
                                      }
                                    } else {
                                      validate27.errors = [{ instancePath: instancePath + "/monthlyAdmission/startInclusive", schemaPath: "#/properties/monthlyAdmission/properties/startInclusive/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                      return false;
                                    }
                                  }
                                }
                                var valid8 = _errs81 === errors2;
                              } else {
                                var valid8 = true;
                              }
                              if (valid8) {
                                if (data36.knownChargeMicroUsd !== void 0) {
                                  let data38 = data36.knownChargeMicroUsd;
                                  const _errs83 = errors2;
                                  if (!(typeof data38 == "number" && (!(data38 % 1) && !isNaN(data38)) && isFinite(data38))) {
                                    validate27.errors = [{ instancePath: instancePath + "/monthlyAdmission/knownChargeMicroUsd", schemaPath: "#/properties/monthlyAdmission/properties/knownChargeMicroUsd/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                    return false;
                                  }
                                  if (errors2 === _errs83) {
                                    if (typeof data38 == "number" && isFinite(data38)) {
                                      if (data38 > 9007199254740991 || isNaN(data38)) {
                                        validate27.errors = [{ instancePath: instancePath + "/monthlyAdmission/knownChargeMicroUsd", schemaPath: "#/properties/monthlyAdmission/properties/knownChargeMicroUsd/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                        return false;
                                      } else {
                                        if (data38 < 0 || isNaN(data38)) {
                                          validate27.errors = [{ instancePath: instancePath + "/monthlyAdmission/knownChargeMicroUsd", schemaPath: "#/properties/monthlyAdmission/properties/knownChargeMicroUsd/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                          return false;
                                        }
                                      }
                                    }
                                  }
                                  var valid8 = _errs83 === errors2;
                                } else {
                                  var valid8 = true;
                                }
                                if (valid8) {
                                  if (data36.unavailableRecordedAttempts !== void 0) {
                                    let data39 = data36.unavailableRecordedAttempts;
                                    const _errs85 = errors2;
                                    if (!(typeof data39 == "number" && (!(data39 % 1) && !isNaN(data39)) && isFinite(data39))) {
                                      validate27.errors = [{ instancePath: instancePath + "/monthlyAdmission/unavailableRecordedAttempts", schemaPath: "#/properties/monthlyAdmission/properties/unavailableRecordedAttempts/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                      return false;
                                    }
                                    if (errors2 === _errs85) {
                                      if (typeof data39 == "number" && isFinite(data39)) {
                                        if (data39 > 9007199254740991 || isNaN(data39)) {
                                          validate27.errors = [{ instancePath: instancePath + "/monthlyAdmission/unavailableRecordedAttempts", schemaPath: "#/properties/monthlyAdmission/properties/unavailableRecordedAttempts/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                          return false;
                                        } else {
                                          if (data39 < 0 || isNaN(data39)) {
                                            validate27.errors = [{ instancePath: instancePath + "/monthlyAdmission/unavailableRecordedAttempts", schemaPath: "#/properties/monthlyAdmission/properties/unavailableRecordedAttempts/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                            return false;
                                          }
                                        }
                                      }
                                    }
                                    var valid8 = _errs85 === errors2;
                                  } else {
                                    var valid8 = true;
                                  }
                                  if (valid8) {
                                    if (data36.remainingKnownMicroUsd !== void 0) {
                                      let data40 = data36.remainingKnownMicroUsd;
                                      const _errs87 = errors2;
                                      const _errs88 = errors2;
                                      let valid9 = false;
                                      const _errs89 = errors2;
                                      if (!(typeof data40 == "number" && (!(data40 % 1) && !isNaN(data40)) && isFinite(data40))) {
                                        const err25 = { instancePath: instancePath + "/monthlyAdmission/remainingKnownMicroUsd", schemaPath: "#/properties/monthlyAdmission/properties/remainingKnownMicroUsd/anyOf/0/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                        if (vErrors === null) {
                                          vErrors = [err25];
                                        } else {
                                          vErrors.push(err25);
                                        }
                                        errors2++;
                                      }
                                      if (errors2 === _errs89) {
                                        if (typeof data40 == "number" && isFinite(data40)) {
                                          if (data40 > 9007199254740991 || isNaN(data40)) {
                                            const err26 = { instancePath: instancePath + "/monthlyAdmission/remainingKnownMicroUsd", schemaPath: "#/properties/monthlyAdmission/properties/remainingKnownMicroUsd/anyOf/0/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                            if (vErrors === null) {
                                              vErrors = [err26];
                                            } else {
                                              vErrors.push(err26);
                                            }
                                            errors2++;
                                          } else {
                                            if (data40 < 0 || isNaN(data40)) {
                                              const err27 = { instancePath: instancePath + "/monthlyAdmission/remainingKnownMicroUsd", schemaPath: "#/properties/monthlyAdmission/properties/remainingKnownMicroUsd/anyOf/0/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
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
                                      var _valid1 = _errs89 === errors2;
                                      valid9 = valid9 || _valid1;
                                      const _errs91 = errors2;
                                      if (data40 !== null) {
                                        const err28 = { instancePath: instancePath + "/monthlyAdmission/remainingKnownMicroUsd", schemaPath: "#/properties/monthlyAdmission/properties/remainingKnownMicroUsd/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                        if (vErrors === null) {
                                          vErrors = [err28];
                                        } else {
                                          vErrors.push(err28);
                                        }
                                        errors2++;
                                      }
                                      var _valid1 = _errs91 === errors2;
                                      valid9 = valid9 || _valid1;
                                      if (!valid9) {
                                        const err29 = { instancePath: instancePath + "/monthlyAdmission/remainingKnownMicroUsd", schemaPath: "#/properties/monthlyAdmission/properties/remainingKnownMicroUsd/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                        if (vErrors === null) {
                                          vErrors = [err29];
                                        } else {
                                          vErrors.push(err29);
                                        }
                                        errors2++;
                                        validate27.errors = vErrors;
                                        return false;
                                      } else {
                                        errors2 = _errs88;
                                        if (vErrors !== null) {
                                          if (_errs88) {
                                            vErrors.length = _errs88;
                                          } else {
                                            vErrors = null;
                                          }
                                        }
                                      }
                                      var valid8 = _errs87 === errors2;
                                    } else {
                                      var valid8 = true;
                                    }
                                    if (valid8) {
                                      if (data36.reached !== void 0) {
                                        let data41 = data36.reached;
                                        const _errs93 = errors2;
                                        const _errs94 = errors2;
                                        let valid10 = false;
                                        const _errs95 = errors2;
                                        if (typeof data41 !== "boolean") {
                                          const err30 = { instancePath: instancePath + "/monthlyAdmission/reached", schemaPath: "#/properties/monthlyAdmission/properties/reached/anyOf/0/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
                                          if (vErrors === null) {
                                            vErrors = [err30];
                                          } else {
                                            vErrors.push(err30);
                                          }
                                          errors2++;
                                        }
                                        var _valid2 = _errs95 === errors2;
                                        valid10 = valid10 || _valid2;
                                        const _errs97 = errors2;
                                        if (data41 !== null) {
                                          const err31 = { instancePath: instancePath + "/monthlyAdmission/reached", schemaPath: "#/properties/monthlyAdmission/properties/reached/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                          if (vErrors === null) {
                                            vErrors = [err31];
                                          } else {
                                            vErrors.push(err31);
                                          }
                                          errors2++;
                                        }
                                        var _valid2 = _errs97 === errors2;
                                        valid10 = valid10 || _valid2;
                                        if (!valid10) {
                                          const err32 = { instancePath: instancePath + "/monthlyAdmission/reached", schemaPath: "#/properties/monthlyAdmission/properties/reached/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                          if (vErrors === null) {
                                            vErrors = [err32];
                                          } else {
                                            vErrors.push(err32);
                                          }
                                          errors2++;
                                          validate27.errors = vErrors;
                                          return false;
                                        } else {
                                          errors2 = _errs94;
                                          if (vErrors !== null) {
                                            if (_errs94) {
                                              vErrors.length = _errs94;
                                            } else {
                                              vErrors = null;
                                            }
                                          }
                                        }
                                        var valid8 = _errs93 === errors2;
                                      } else {
                                        var valid8 = true;
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        } else {
                          validate27.errors = [{ instancePath: instancePath + "/monthlyAdmission", schemaPath: "#/properties/monthlyAdmission/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                          return false;
                        }
                      }
                      var valid0 = _errs78 === errors2;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.queue !== void 0) {
                        let data42 = data.queue;
                        const _errs99 = errors2;
                        if (errors2 === _errs99) {
                          if (data42 && typeof data42 == "object" && !Array.isArray(data42)) {
                            let missing7;
                            if (data42.basis === void 0 && (missing7 = "basis") || data42.states === void 0 && (missing7 = "states") || data42.physicalConcurrency === void 0 && (missing7 = "physicalConcurrency") || data42.availableCapacity === void 0 && (missing7 = "availableCapacity") || data42.capacityStatus === void 0 && (missing7 = "capacityStatus")) {
                              validate27.errors = [{ instancePath: instancePath + "/queue", schemaPath: "#/properties/queue/required", keyword: "required", params: { missingProperty: missing7 }, message: "must have required property '" + missing7 + "'" }];
                              return false;
                            } else {
                              const _errs101 = errors2;
                              for (const key7 in data42) {
                                if (!(key7 === "basis" || key7 === "states" || key7 === "physicalConcurrency" || key7 === "availableCapacity" || key7 === "capacityStatus")) {
                                  validate27.errors = [{ instancePath: instancePath + "/queue", schemaPath: "#/properties/queue/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key7 }, message: "must NOT have additional properties" }];
                                  return false;
                                  break;
                                }
                              }
                              if (_errs101 === errors2) {
                                if (data42.basis !== void 0) {
                                  const _errs102 = errors2;
                                  if ("recorded-run-state" !== data42.basis) {
                                    validate27.errors = [{ instancePath: instancePath + "/queue/basis", schemaPath: "#/properties/queue/properties/basis/const", keyword: "const", params: { allowedValue: "recorded-run-state" }, message: "must be equal to constant" }];
                                    return false;
                                  }
                                  var valid11 = _errs102 === errors2;
                                } else {
                                  var valid11 = true;
                                }
                                if (valid11) {
                                  if (data42.states !== void 0) {
                                    let data44 = data42.states;
                                    const _errs103 = errors2;
                                    if (errors2 === _errs103) {
                                      if (data44 && typeof data44 == "object" && !Array.isArray(data44)) {
                                        let missing8;
                                        if (data44.queued === void 0 && (missing8 = "queued") || data44.starting === void 0 && (missing8 = "starting") || data44.running === void 0 && (missing8 = "running") || data44["waiting-for-approval"] === void 0 && (missing8 = "waiting-for-approval") || data44.paused === void 0 && (missing8 = "paused") || data44.completed === void 0 && (missing8 = "completed") || data44.failed === void 0 && (missing8 = "failed") || data44.cancelled === void 0 && (missing8 = "cancelled")) {
                                          validate27.errors = [{ instancePath: instancePath + "/queue/states", schemaPath: "#/properties/queue/properties/states/required", keyword: "required", params: { missingProperty: missing8 }, message: "must have required property '" + missing8 + "'" }];
                                          return false;
                                        } else {
                                          const _errs105 = errors2;
                                          for (const key8 in data44) {
                                            if (!(key8 === "queued" || key8 === "starting" || key8 === "running" || key8 === "waiting-for-approval" || key8 === "paused" || key8 === "completed" || key8 === "failed" || key8 === "cancelled")) {
                                              validate27.errors = [{ instancePath: instancePath + "/queue/states", schemaPath: "#/properties/queue/properties/states/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key8 }, message: "must NOT have additional properties" }];
                                              return false;
                                              break;
                                            }
                                          }
                                          if (_errs105 === errors2) {
                                            if (data44.queued !== void 0) {
                                              let data45 = data44.queued;
                                              const _errs106 = errors2;
                                              if (!(typeof data45 == "number" && (!(data45 % 1) && !isNaN(data45)) && isFinite(data45))) {
                                                validate27.errors = [{ instancePath: instancePath + "/queue/states/queued", schemaPath: "#/properties/queue/properties/states/properties/queued/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                return false;
                                              }
                                              if (errors2 === _errs106) {
                                                if (typeof data45 == "number" && isFinite(data45)) {
                                                  if (data45 > 9007199254740991 || isNaN(data45)) {
                                                    validate27.errors = [{ instancePath: instancePath + "/queue/states/queued", schemaPath: "#/properties/queue/properties/states/properties/queued/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                    return false;
                                                  } else {
                                                    if (data45 < 0 || isNaN(data45)) {
                                                      validate27.errors = [{ instancePath: instancePath + "/queue/states/queued", schemaPath: "#/properties/queue/properties/states/properties/queued/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                      return false;
                                                    }
                                                  }
                                                }
                                              }
                                              var valid12 = _errs106 === errors2;
                                            } else {
                                              var valid12 = true;
                                            }
                                            if (valid12) {
                                              if (data44.starting !== void 0) {
                                                let data46 = data44.starting;
                                                const _errs108 = errors2;
                                                if (!(typeof data46 == "number" && (!(data46 % 1) && !isNaN(data46)) && isFinite(data46))) {
                                                  validate27.errors = [{ instancePath: instancePath + "/queue/states/starting", schemaPath: "#/properties/queue/properties/states/properties/starting/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                  return false;
                                                }
                                                if (errors2 === _errs108) {
                                                  if (typeof data46 == "number" && isFinite(data46)) {
                                                    if (data46 > 9007199254740991 || isNaN(data46)) {
                                                      validate27.errors = [{ instancePath: instancePath + "/queue/states/starting", schemaPath: "#/properties/queue/properties/states/properties/starting/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                      return false;
                                                    } else {
                                                      if (data46 < 0 || isNaN(data46)) {
                                                        validate27.errors = [{ instancePath: instancePath + "/queue/states/starting", schemaPath: "#/properties/queue/properties/states/properties/starting/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                        return false;
                                                      }
                                                    }
                                                  }
                                                }
                                                var valid12 = _errs108 === errors2;
                                              } else {
                                                var valid12 = true;
                                              }
                                              if (valid12) {
                                                if (data44.running !== void 0) {
                                                  let data47 = data44.running;
                                                  const _errs110 = errors2;
                                                  if (!(typeof data47 == "number" && (!(data47 % 1) && !isNaN(data47)) && isFinite(data47))) {
                                                    validate27.errors = [{ instancePath: instancePath + "/queue/states/running", schemaPath: "#/properties/queue/properties/states/properties/running/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                    return false;
                                                  }
                                                  if (errors2 === _errs110) {
                                                    if (typeof data47 == "number" && isFinite(data47)) {
                                                      if (data47 > 9007199254740991 || isNaN(data47)) {
                                                        validate27.errors = [{ instancePath: instancePath + "/queue/states/running", schemaPath: "#/properties/queue/properties/states/properties/running/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                        return false;
                                                      } else {
                                                        if (data47 < 0 || isNaN(data47)) {
                                                          validate27.errors = [{ instancePath: instancePath + "/queue/states/running", schemaPath: "#/properties/queue/properties/states/properties/running/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                          return false;
                                                        }
                                                      }
                                                    }
                                                  }
                                                  var valid12 = _errs110 === errors2;
                                                } else {
                                                  var valid12 = true;
                                                }
                                                if (valid12) {
                                                  if (data44["waiting-for-approval"] !== void 0) {
                                                    let data48 = data44["waiting-for-approval"];
                                                    const _errs112 = errors2;
                                                    if (!(typeof data48 == "number" && (!(data48 % 1) && !isNaN(data48)) && isFinite(data48))) {
                                                      validate27.errors = [{ instancePath: instancePath + "/queue/states/waiting-for-approval", schemaPath: "#/properties/queue/properties/states/properties/waiting-for-approval/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                      return false;
                                                    }
                                                    if (errors2 === _errs112) {
                                                      if (typeof data48 == "number" && isFinite(data48)) {
                                                        if (data48 > 9007199254740991 || isNaN(data48)) {
                                                          validate27.errors = [{ instancePath: instancePath + "/queue/states/waiting-for-approval", schemaPath: "#/properties/queue/properties/states/properties/waiting-for-approval/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                          return false;
                                                        } else {
                                                          if (data48 < 0 || isNaN(data48)) {
                                                            validate27.errors = [{ instancePath: instancePath + "/queue/states/waiting-for-approval", schemaPath: "#/properties/queue/properties/states/properties/waiting-for-approval/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                            return false;
                                                          }
                                                        }
                                                      }
                                                    }
                                                    var valid12 = _errs112 === errors2;
                                                  } else {
                                                    var valid12 = true;
                                                  }
                                                  if (valid12) {
                                                    if (data44.paused !== void 0) {
                                                      let data49 = data44.paused;
                                                      const _errs114 = errors2;
                                                      if (!(typeof data49 == "number" && (!(data49 % 1) && !isNaN(data49)) && isFinite(data49))) {
                                                        validate27.errors = [{ instancePath: instancePath + "/queue/states/paused", schemaPath: "#/properties/queue/properties/states/properties/paused/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                        return false;
                                                      }
                                                      if (errors2 === _errs114) {
                                                        if (typeof data49 == "number" && isFinite(data49)) {
                                                          if (data49 > 9007199254740991 || isNaN(data49)) {
                                                            validate27.errors = [{ instancePath: instancePath + "/queue/states/paused", schemaPath: "#/properties/queue/properties/states/properties/paused/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                            return false;
                                                          } else {
                                                            if (data49 < 0 || isNaN(data49)) {
                                                              validate27.errors = [{ instancePath: instancePath + "/queue/states/paused", schemaPath: "#/properties/queue/properties/states/properties/paused/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                              return false;
                                                            }
                                                          }
                                                        }
                                                      }
                                                      var valid12 = _errs114 === errors2;
                                                    } else {
                                                      var valid12 = true;
                                                    }
                                                    if (valid12) {
                                                      if (data44.completed !== void 0) {
                                                        let data50 = data44.completed;
                                                        const _errs116 = errors2;
                                                        if (!(typeof data50 == "number" && (!(data50 % 1) && !isNaN(data50)) && isFinite(data50))) {
                                                          validate27.errors = [{ instancePath: instancePath + "/queue/states/completed", schemaPath: "#/properties/queue/properties/states/properties/completed/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                          return false;
                                                        }
                                                        if (errors2 === _errs116) {
                                                          if (typeof data50 == "number" && isFinite(data50)) {
                                                            if (data50 > 9007199254740991 || isNaN(data50)) {
                                                              validate27.errors = [{ instancePath: instancePath + "/queue/states/completed", schemaPath: "#/properties/queue/properties/states/properties/completed/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                              return false;
                                                            } else {
                                                              if (data50 < 0 || isNaN(data50)) {
                                                                validate27.errors = [{ instancePath: instancePath + "/queue/states/completed", schemaPath: "#/properties/queue/properties/states/properties/completed/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                return false;
                                                              }
                                                            }
                                                          }
                                                        }
                                                        var valid12 = _errs116 === errors2;
                                                      } else {
                                                        var valid12 = true;
                                                      }
                                                      if (valid12) {
                                                        if (data44.failed !== void 0) {
                                                          let data51 = data44.failed;
                                                          const _errs118 = errors2;
                                                          if (!(typeof data51 == "number" && (!(data51 % 1) && !isNaN(data51)) && isFinite(data51))) {
                                                            validate27.errors = [{ instancePath: instancePath + "/queue/states/failed", schemaPath: "#/properties/queue/properties/states/properties/failed/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                            return false;
                                                          }
                                                          if (errors2 === _errs118) {
                                                            if (typeof data51 == "number" && isFinite(data51)) {
                                                              if (data51 > 9007199254740991 || isNaN(data51)) {
                                                                validate27.errors = [{ instancePath: instancePath + "/queue/states/failed", schemaPath: "#/properties/queue/properties/states/properties/failed/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                return false;
                                                              } else {
                                                                if (data51 < 0 || isNaN(data51)) {
                                                                  validate27.errors = [{ instancePath: instancePath + "/queue/states/failed", schemaPath: "#/properties/queue/properties/states/properties/failed/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                  return false;
                                                                }
                                                              }
                                                            }
                                                          }
                                                          var valid12 = _errs118 === errors2;
                                                        } else {
                                                          var valid12 = true;
                                                        }
                                                        if (valid12) {
                                                          if (data44.cancelled !== void 0) {
                                                            let data52 = data44.cancelled;
                                                            const _errs120 = errors2;
                                                            if (!(typeof data52 == "number" && (!(data52 % 1) && !isNaN(data52)) && isFinite(data52))) {
                                                              validate27.errors = [{ instancePath: instancePath + "/queue/states/cancelled", schemaPath: "#/properties/queue/properties/states/properties/cancelled/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                              return false;
                                                            }
                                                            if (errors2 === _errs120) {
                                                              if (typeof data52 == "number" && isFinite(data52)) {
                                                                if (data52 > 9007199254740991 || isNaN(data52)) {
                                                                  validate27.errors = [{ instancePath: instancePath + "/queue/states/cancelled", schemaPath: "#/properties/queue/properties/states/properties/cancelled/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                  return false;
                                                                } else {
                                                                  if (data52 < 0 || isNaN(data52)) {
                                                                    validate27.errors = [{ instancePath: instancePath + "/queue/states/cancelled", schemaPath: "#/properties/queue/properties/states/properties/cancelled/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                    return false;
                                                                  }
                                                                }
                                                              }
                                                            }
                                                            var valid12 = _errs120 === errors2;
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
                                      } else {
                                        validate27.errors = [{ instancePath: instancePath + "/queue/states", schemaPath: "#/properties/queue/properties/states/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                        return false;
                                      }
                                    }
                                    var valid11 = _errs103 === errors2;
                                  } else {
                                    var valid11 = true;
                                  }
                                  if (valid11) {
                                    if (data42.physicalConcurrency !== void 0) {
                                      const _errs122 = errors2;
                                      if (data42.physicalConcurrency !== null) {
                                        validate27.errors = [{ instancePath: instancePath + "/queue/physicalConcurrency", schemaPath: "#/properties/queue/properties/physicalConcurrency/type", keyword: "type", params: { type: "null" }, message: "must be null" }];
                                        return false;
                                      }
                                      var valid11 = _errs122 === errors2;
                                    } else {
                                      var valid11 = true;
                                    }
                                    if (valid11) {
                                      if (data42.availableCapacity !== void 0) {
                                        const _errs124 = errors2;
                                        if (data42.availableCapacity !== null) {
                                          validate27.errors = [{ instancePath: instancePath + "/queue/availableCapacity", schemaPath: "#/properties/queue/properties/availableCapacity/type", keyword: "type", params: { type: "null" }, message: "must be null" }];
                                          return false;
                                        }
                                        var valid11 = _errs124 === errors2;
                                      } else {
                                        var valid11 = true;
                                      }
                                      if (valid11) {
                                        if (data42.capacityStatus !== void 0) {
                                          const _errs126 = errors2;
                                          if ("unavailable" !== data42.capacityStatus) {
                                            validate27.errors = [{ instancePath: instancePath + "/queue/capacityStatus", schemaPath: "#/properties/queue/properties/capacityStatus/const", keyword: "const", params: { allowedValue: "unavailable" }, message: "must be equal to constant" }];
                                            return false;
                                          }
                                          var valid11 = _errs126 === errors2;
                                        } else {
                                          var valid11 = true;
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          } else {
                            validate27.errors = [{ instancePath: instancePath + "/queue", schemaPath: "#/properties/queue/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                            return false;
                          }
                        }
                        var valid0 = _errs99 === errors2;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.coverage !== void 0) {
                          let data56 = data.coverage;
                          const _errs127 = errors2;
                          if (errors2 === _errs127) {
                            if (data56 && typeof data56 == "object" && !Array.isArray(data56)) {
                              let missing9;
                              if (data56.attemptPeriodBasis === void 0 && (missing9 = "attemptPeriodBasis") || data56.admissionPeriodBasis === void 0 && (missing9 = "admissionPeriodBasis") || data56.chargeBasis === void 0 && (missing9 = "chargeBasis") || data56.providerBilledMicroUsd === void 0 && (missing9 = "providerBilledMicroUsd") || data56.completeJobCost === void 0 && (missing9 = "completeJobCost")) {
                                validate27.errors = [{ instancePath: instancePath + "/coverage", schemaPath: "#/properties/coverage/required", keyword: "required", params: { missingProperty: missing9 }, message: "must have required property '" + missing9 + "'" }];
                                return false;
                              } else {
                                const _errs129 = errors2;
                                for (const key9 in data56) {
                                  if (!(key9 === "attemptPeriodBasis" || key9 === "admissionPeriodBasis" || key9 === "chargeBasis" || key9 === "providerBilledMicroUsd" || key9 === "completeJobCost")) {
                                    validate27.errors = [{ instancePath: instancePath + "/coverage", schemaPath: "#/properties/coverage/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key9 }, message: "must NOT have additional properties" }];
                                    return false;
                                    break;
                                  }
                                }
                                if (_errs129 === errors2) {
                                  if (data56.attemptPeriodBasis !== void 0) {
                                    const _errs130 = errors2;
                                    if ("run-created-at" !== data56.attemptPeriodBasis) {
                                      validate27.errors = [{ instancePath: instancePath + "/coverage/attemptPeriodBasis", schemaPath: "#/properties/coverage/properties/attemptPeriodBasis/const", keyword: "const", params: { allowedValue: "run-created-at" }, message: "must be equal to constant" }];
                                      return false;
                                    }
                                    var valid13 = _errs130 === errors2;
                                  } else {
                                    var valid13 = true;
                                  }
                                  if (valid13) {
                                    if (data56.admissionPeriodBasis !== void 0) {
                                      const _errs131 = errors2;
                                      if ("sdk-usage-recorded-at" !== data56.admissionPeriodBasis) {
                                        validate27.errors = [{ instancePath: instancePath + "/coverage/admissionPeriodBasis", schemaPath: "#/properties/coverage/properties/admissionPeriodBasis/const", keyword: "const", params: { allowedValue: "sdk-usage-recorded-at" }, message: "must be equal to constant" }];
                                        return false;
                                      }
                                      var valid13 = _errs131 === errors2;
                                    } else {
                                      var valid13 = true;
                                    }
                                    if (valid13) {
                                      if (data56.chargeBasis !== void 0) {
                                        const _errs132 = errors2;
                                        if ("recorded-sdk-estimate" !== data56.chargeBasis) {
                                          validate27.errors = [{ instancePath: instancePath + "/coverage/chargeBasis", schemaPath: "#/properties/coverage/properties/chargeBasis/const", keyword: "const", params: { allowedValue: "recorded-sdk-estimate" }, message: "must be equal to constant" }];
                                          return false;
                                        }
                                        var valid13 = _errs132 === errors2;
                                      } else {
                                        var valid13 = true;
                                      }
                                      if (valid13) {
                                        if (data56.providerBilledMicroUsd !== void 0) {
                                          const _errs133 = errors2;
                                          if (data56.providerBilledMicroUsd !== null) {
                                            validate27.errors = [{ instancePath: instancePath + "/coverage/providerBilledMicroUsd", schemaPath: "#/properties/coverage/properties/providerBilledMicroUsd/type", keyword: "type", params: { type: "null" }, message: "must be null" }];
                                            return false;
                                          }
                                          var valid13 = _errs133 === errors2;
                                        } else {
                                          var valid13 = true;
                                        }
                                        if (valid13) {
                                          if (data56.completeJobCost !== void 0) {
                                            const _errs135 = errors2;
                                            if ("unavailable" !== data56.completeJobCost) {
                                              validate27.errors = [{ instancePath: instancePath + "/coverage/completeJobCost", schemaPath: "#/properties/coverage/properties/completeJobCost/const", keyword: "const", params: { allowedValue: "unavailable" }, message: "must be equal to constant" }];
                                              return false;
                                            }
                                            var valid13 = _errs135 === errors2;
                                          } else {
                                            var valid13 = true;
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            } else {
                              validate27.errors = [{ instancePath: instancePath + "/coverage", schemaPath: "#/properties/coverage/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                              return false;
                            }
                          }
                          var valid0 = _errs127 === errors2;
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
      validate27.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate27.errors = vErrors;
  return errors2 === 0;
}
validate27.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateOverviewRequest2 = validate28;
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
      if (data.schemaVersion === void 0 && (missing0 = "schemaVersion")) {
        validate28.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "schemaVersion")) {
            validate28.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.schemaVersion !== void 0) {
            if ("meri.usage-overview/2" !== data.schemaVersion) {
              validate28.errors = [{ instancePath: instancePath + "/schemaVersion", schemaPath: "#/properties/schemaVersion/const", keyword: "const", params: { allowedValue: "meri.usage-overview/2" }, message: "must be equal to constant" }];
              return false;
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
var validateOverviewResponse2 = validate29;
var schema40 = { "type": "object", "properties": { "schemaVersion": { "const": "meri.usage-overview/2" }, "observedAt": { "type": "string", "format": "date-time", "pattern": "Z$" }, "timezone": { "const": "UTC" }, "currency": { "const": "USD" }, "countersCoverage": { "const": "recorded-runs-only" }, "policy": { "oneOf": [{ "type": "object", "properties": { "status": { "const": "configured" }, "revision": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 }, "monthlyCapMicroUsd": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 }, "maxTurns": { "type": "integer", "minimum": 1, "maximum": 100 }, "maxBudgetMicroUsd": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 } }, "required": ["status", "revision", "monthlyCapMicroUsd", "maxTurns", "maxBudgetMicroUsd"], "additionalProperties": false }, { "type": "object", "properties": { "status": { "const": "unavailable" }, "revision": { "type": "null" }, "monthlyCapMicroUsd": { "type": "null" }, "maxTurns": { "type": "null" }, "maxBudgetMicroUsd": { "type": "null" } }, "required": ["status", "revision", "monthlyCapMicroUsd", "maxTurns", "maxBudgetMicroUsd"], "additionalProperties": false }] }, "periods": { "type": "array", "items": { "type": "object", "properties": { "kind": { "enum": ["day", "week", "month"] }, "startInclusive": { "type": "string", "format": "date-time", "pattern": "Z$" }, "endExclusive": { "type": "string", "format": "date-time", "pattern": "Z$" }, "attempts": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "states": { "type": "object", "properties": { "queued": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "starting": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "running": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "waiting-for-approval": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "paused": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "completed": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "failed": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "cancelled": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 } }, "required": ["queued", "starting", "running", "waiting-for-approval", "paused", "completed", "failed", "cancelled"], "additionalProperties": false }, "recording": { "type": "object", "properties": { "recorded": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "unavailable": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "notRecorded": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 } }, "required": ["recorded", "unavailable", "notRecorded"], "additionalProperties": false }, "knownChargeMicroUsd": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "recorded": { "type": "object", "properties": { "queued": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "starting": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "running": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "waiting-for-approval": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "paused": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "completed": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "failed": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "cancelled": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 } }, "required": ["queued", "starting", "running", "waiting-for-approval", "paused", "completed", "failed", "cancelled"], "additionalProperties": false }, "conversationThreads": { "type": "object", "properties": { "status": { "enum": ["measured", "unavailable"] }, "basis": { "const": "distinct-conversation-id-by-run-created-at" }, "threads": { "anyOf": [{ "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, { "type": "null" }] }, "attempts": { "anyOf": [{ "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, { "type": "null" }] } }, "required": ["status", "basis", "threads", "attempts"], "additionalProperties": false }, "completedAttempts": { "type": "object", "properties": { "status": { "enum": ["estimated", "unavailable"] }, "chargeBasis": { "const": "sdk-list-estimate" }, "jobIdentity": { "const": "not-a-job-denominator" }, "attempts": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "knownChargeMicroUsd": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "microUsdPerCompletedAttempt": { "anyOf": [{ "type": "number", "minimum": 0, "maximum": 9007199254740992e-6 }, { "type": "null" }] }, "attemptsWithoutRecordedUsage": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 } }, "required": ["status", "chargeBasis", "jobIdentity", "attempts", "knownChargeMicroUsd", "microUsdPerCompletedAttempt", "attemptsWithoutRecordedUsage"], "additionalProperties": false }, "partialOrFailed": { "type": "object", "properties": { "status": { "enum": ["estimated", "unavailable"] }, "chargeBasis": { "const": "sdk-list-estimate" }, "failedAttempts": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "cancelledAttempts": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "recordedAttempts": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "knownChargeMicroUsd": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "microUsdPerRecordedAttempt": { "anyOf": [{ "type": "number", "minimum": 0, "maximum": 9007199254740992e-6 }, { "type": "null" }] } }, "required": ["status", "chargeBasis", "failedAttempts", "cancelledAttempts", "recordedAttempts", "knownChargeMicroUsd", "microUsdPerRecordedAttempt"], "additionalProperties": false }, "liability": { "type": "object", "properties": { "chargeBasis": { "const": "sdk-list-estimate" }, "recordedAttempts": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "knownChargeMicroUsd": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "microUsdPerRecordedAttempt": { "anyOf": [{ "type": "number", "minimum": 0, "maximum": 9007199254740992e-6 }, { "type": "null" }] }, "unavailableAttempts": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "notRecordedAttempts": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 } }, "required": ["chargeBasis", "recordedAttempts", "knownChargeMicroUsd", "microUsdPerRecordedAttempt", "unavailableAttempts", "notRecordedAttempts"], "additionalProperties": false }, "lineage": { "type": "object", "properties": { "basis": { "const": "sdk_usage.parentRunId plus the run binding writerFence: absent parent = root thread start; writerFence 1 = fork into a separate logical thread; writerFence 2 or more = resume continuation of the same thread" }, "root": { "type": "object", "properties": { "attempts": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "chargeMicroUsd": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 } }, "required": ["attempts", "chargeMicroUsd"], "additionalProperties": false }, "fork": { "type": "object", "properties": { "attempts": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "chargeMicroUsd": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 } }, "required": ["attempts", "chargeMicroUsd"], "additionalProperties": false }, "resume": { "type": "object", "properties": { "attempts": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "chargeMicroUsd": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 } }, "required": ["attempts", "chargeMicroUsd"], "additionalProperties": false }, "unknown-lineage": { "type": "object", "properties": { "attempts": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "chargeMicroUsd": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 } }, "required": ["attempts", "chargeMicroUsd"], "additionalProperties": false } }, "required": ["basis", "root", "fork", "resume", "unknown-lineage"], "additionalProperties": false }, "counters": { "type": "object", "properties": { "inputTokens": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "outputTokens": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "cacheReadInputTokens": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "cacheCreationInputTokens": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "webSearchRequests": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "toolInvocations": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "toolFailures": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 } }, "required": ["inputTokens", "outputTokens", "cacheReadInputTokens", "cacheCreationInputTokens", "webSearchRequests", "toolInvocations", "toolFailures"], "additionalProperties": false } }, "required": ["kind", "startInclusive", "endExclusive", "attempts", "states", "recording", "knownChargeMicroUsd", "recorded", "conversationThreads", "completedAttempts", "partialOrFailed", "liability", "lineage", "counters"], "additionalProperties": false }, "minItems": 3, "maxItems": 3 }, "monthlyAdmission": { "type": "object", "properties": { "startInclusive": { "type": "string", "format": "date-time", "pattern": "Z$" }, "knownChargeMicroUsd": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "unavailableRecordedAttempts": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "remainingKnownMicroUsd": { "anyOf": [{ "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, { "type": "null" }] }, "reached": { "anyOf": [{ "type": "boolean" }, { "type": "null" }] } }, "required": ["startInclusive", "knownChargeMicroUsd", "unavailableRecordedAttempts", "remainingKnownMicroUsd", "reached"], "additionalProperties": false }, "queue": { "type": "object", "properties": { "basis": { "const": "recorded-run-state" }, "states": { "type": "object", "properties": { "queued": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "starting": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "running": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "waiting-for-approval": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "paused": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "completed": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "failed": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "cancelled": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 } }, "required": ["queued", "starting", "running", "waiting-for-approval", "paused", "completed", "failed", "cancelled"], "additionalProperties": false }, "physicalConcurrency": { "type": "null" }, "availableCapacity": { "type": "null" }, "capacityStatus": { "const": "unavailable" } }, "required": ["basis", "states", "physicalConcurrency", "availableCapacity", "capacityStatus"], "additionalProperties": false }, "coverage": { "type": "object", "properties": { "attemptPeriodBasis": { "const": "run-created-at" }, "admissionPeriodBasis": { "const": "sdk-usage-recorded-at" }, "chargeBasis": { "const": "sdk-list-estimate" }, "providerBilledMicroUsd": { "type": "null" }, "completeJobCost": { "const": "estimated" } }, "required": ["attemptPeriodBasis", "admissionPeriodBasis", "chargeBasis", "providerBilledMicroUsd", "completeJobCost"], "additionalProperties": false }, "denominators": { "type": "object", "properties": { "attempts": { "const": "run rows in the ledger; one run is one attempt or turn, never a job" }, "conversationThreads": { "const": "distinct conversation_id with at least one run created in the period; a thread may host several attempts" }, "sustainedJobs": { "const": "canonical ROOT Work/Delegate objectives: the run whose stored request carries request.work with entry start-work|delegate, together with every run that continues it through the persisted continuation custody. A child assignment, conversation thread, SDK attempt or one completed run is never a job" } }, "required": ["attempts", "conversationThreads", "sustainedJobs"], "additionalProperties": false }, "jobIdentity": { "type": "object", "properties": { "status": { "const": "measured" }, "definition": { "const": "one whole job is the canonical ROOT Work/Delegate objective across its continuations and current goal revision; it is never a child assignment, conversation thread, SDK attempt or one completed run" }, "lineage": { "const": "a run continues another objective only when the canonical continuation owner verifies that run stored continuation envelope in the same transaction and that envelope is a resume naming that source run stored request, so its source request digest equals the source run request_sha256; a fork and a run without that verified custody each start a new objective, because the canonical prompt identity owner makes a fork and a next prompt new logical prompts" }, "closure": { "const": "the existing completion producer decides. successful = every current revision is completed and carries a PUBLISHED native-session completion capture whose identity pins that revision, with no unresolved successor and no unsettled child receipt; failed = every current revision reached failed; cancelled = every current revision reached cancelled; partial = a current revision is still in flight, or terminal revisions carry mixed outcomes; unclosed = a current revision is terminal without that closure proof, or a continuation control is unresolved (not APPLIED, or its successor revision is outside this read window), or a child receipt is unresolved" }, "owner": { "const": "the existing lifecycle completion producer (meri_conversations.completion_checkpoints) read over the existing run and control lineage; no second store, ledger, scheduler or table is created" }, "states": { "type": "array", "items": { "enum": ["successful", "partial", "failed", "cancelled", "unclosed"] }, "minItems": 5, "maxItems": 5 } }, "required": ["status", "definition", "lineage", "closure", "owner", "states"], "additionalProperties": false }, "wholeJobs": { "type": "object", "properties": { "basis": { "const": "canonical ROOT Work/Delegate objectives: the run whose stored request carries request.work with entry start-work|delegate, together with every run that continues it through the persisted continuation custody. A child assignment, conversation thread, SDK attempt or one completed run is never a job" }, "window": { "const": "root revision created within the admitted month window" }, "states": { "type": "object", "properties": { "successful": { "type": "object", "properties": { "jobs": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "attempts": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "knownChargeMicroUsd": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 } }, "required": ["jobs", "attempts", "knownChargeMicroUsd"], "additionalProperties": false }, "partial": { "type": "object", "properties": { "jobs": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "attempts": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "knownChargeMicroUsd": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 } }, "required": ["jobs", "attempts", "knownChargeMicroUsd"], "additionalProperties": false }, "failed": { "type": "object", "properties": { "jobs": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "attempts": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "knownChargeMicroUsd": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 } }, "required": ["jobs", "attempts", "knownChargeMicroUsd"], "additionalProperties": false }, "cancelled": { "type": "object", "properties": { "jobs": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "attempts": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "knownChargeMicroUsd": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 } }, "required": ["jobs", "attempts", "knownChargeMicroUsd"], "additionalProperties": false }, "unclosed": { "type": "object", "properties": { "jobs": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "attempts": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "knownChargeMicroUsd": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 } }, "required": ["jobs", "attempts", "knownChargeMicroUsd"], "additionalProperties": false } }, "required": ["successful", "partial", "failed", "cancelled", "unclosed"], "additionalProperties": false }, "jobs": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "attempts": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "revisions": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "steerRevisions": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "tails": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "settledRevisions": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "closurePending": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "unresolvedSuccessors": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "unsettledChildren": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "knownChargeMicroUsd": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "microUsdPerSuccessfulJob": { "anyOf": [{ "type": "number", "minimum": 0, "maximum": 9007199254740992e-6 }, { "type": "null" }] }, "coverage": { "type": "object", "properties": { "jobsWithRecordedUsage": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "jobsWithUnavailableUsage": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "revisionsWithRootOutsideWindow": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "chargeAttribution": { "const": "whole-job-lineage-at-root-revision-window" }, "windowEdge": { "const": "a revision created after the window is not read, so a job whose continuation falls outside the window is reported from the revisions inside it only, and a continuation whose root revision is outside the window is excluded and counted" }, "providerBilledMicroUsd": { "type": "null" }, "completeJobCost": { "const": "estimated" } }, "required": ["jobsWithRecordedUsage", "jobsWithUnavailableUsage", "revisionsWithRootOutsideWindow", "chargeAttribution", "windowEdge", "providerBilledMicroUsd", "completeJobCost"], "additionalProperties": false } }, "required": ["basis", "window", "states", "jobs", "attempts", "revisions", "steerRevisions", "tails", "settledRevisions", "closurePending", "unresolvedSuccessors", "unsettledChildren", "knownChargeMicroUsd", "microUsdPerSuccessfulJob", "coverage"], "additionalProperties": false }, "categories": { "type": "object", "properties": { "inputTokens": { "enum": ["measured", "estimated", "inside-another-counter", "unresolved", "unavailable"] }, "outputTokens": { "enum": ["measured", "estimated", "inside-another-counter", "unresolved", "unavailable"] }, "reasoningTokens": { "enum": ["measured", "estimated", "inside-another-counter", "unresolved", "unavailable"] }, "cacheReadInputTokens": { "enum": ["measured", "estimated", "inside-another-counter", "unresolved", "unavailable"] }, "cacheCreationInputTokens": { "enum": ["measured", "estimated", "inside-another-counter", "unresolved", "unavailable"] }, "webSearchRequests": { "enum": ["measured", "estimated", "inside-another-counter", "unresolved", "unavailable"] }, "toolInvocations": { "enum": ["measured", "estimated", "inside-another-counter", "unresolved", "unavailable"] }, "toolOutcomes": { "enum": ["measured", "estimated", "inside-another-counter", "unresolved", "unavailable"] }, "cost": { "enum": ["measured", "estimated", "inside-another-counter", "unresolved", "unavailable"] }, "providerBilledMicroUsd": { "enum": ["measured", "estimated", "inside-another-counter", "unresolved", "unavailable"] }, "subagentCost": { "enum": ["measured", "estimated", "inside-another-counter", "unresolved", "unavailable"] }, "compactionCost": { "enum": ["measured", "estimated", "inside-another-counter", "unresolved", "unavailable"] }, "verificationCost": { "enum": ["measured", "estimated", "inside-another-counter", "unresolved", "unavailable"] }, "infrastructureCost": { "enum": ["measured", "estimated", "inside-another-counter", "unresolved", "unavailable"] }, "retryCost": { "enum": ["measured", "estimated", "inside-another-counter", "unresolved", "unavailable"] }, "fallbackCost": { "enum": ["measured", "estimated", "inside-another-counter", "unresolved", "unavailable"] }, "extractionCost": { "enum": ["measured", "estimated", "inside-another-counter", "unresolved", "unavailable"] }, "activityCapacity": { "enum": ["measured", "estimated", "inside-another-counter", "unresolved", "unavailable"] } }, "required": ["inputTokens", "outputTokens", "reasoningTokens", "cacheReadInputTokens", "cacheCreationInputTokens", "webSearchRequests", "toolInvocations", "toolOutcomes", "cost", "providerBilledMicroUsd", "subagentCost", "compactionCost", "verificationCost", "infrastructureCost", "retryCost", "fallbackCost", "extractionCost", "activityCapacity"], "additionalProperties": false }, "occupiedCapacity": { "type": "object", "properties": { "status": { "const": "unavailable" }, "reason": { "type": "string", "minLength": 1, "maxLength": 1024 } }, "required": ["status", "reason"], "additionalProperties": false } }, "required": ["schemaVersion", "observedAt", "timezone", "currency", "countersCoverage", "policy", "periods", "monthlyAdmission", "queue", "coverage", "denominators", "jobIdentity", "wholeJobs", "categories", "occupiedCapacity"], "additionalProperties": false };
var func6 = require_ucs2length().default;
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
      if (data.schemaVersion === void 0 && (missing0 = "schemaVersion") || data.observedAt === void 0 && (missing0 = "observedAt") || data.timezone === void 0 && (missing0 = "timezone") || data.currency === void 0 && (missing0 = "currency") || data.countersCoverage === void 0 && (missing0 = "countersCoverage") || data.policy === void 0 && (missing0 = "policy") || data.periods === void 0 && (missing0 = "periods") || data.monthlyAdmission === void 0 && (missing0 = "monthlyAdmission") || data.queue === void 0 && (missing0 = "queue") || data.coverage === void 0 && (missing0 = "coverage") || data.denominators === void 0 && (missing0 = "denominators") || data.jobIdentity === void 0 && (missing0 = "jobIdentity") || data.wholeJobs === void 0 && (missing0 = "wholeJobs") || data.categories === void 0 && (missing0 = "categories") || data.occupiedCapacity === void 0 && (missing0 = "occupiedCapacity")) {
        validate29.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!func1.call(schema40.properties, key0)) {
            validate29.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.schemaVersion !== void 0) {
            const _errs2 = errors2;
            if ("meri.usage-overview/2" !== data.schemaVersion) {
              validate29.errors = [{ instancePath: instancePath + "/schemaVersion", schemaPath: "#/properties/schemaVersion/const", keyword: "const", params: { allowedValue: "meri.usage-overview/2" }, message: "must be equal to constant" }];
              return false;
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.observedAt !== void 0) {
              let data1 = data.observedAt;
              const _errs3 = errors2;
              if (errors2 === _errs3) {
                if (errors2 === _errs3) {
                  if (typeof data1 === "string") {
                    if (!pattern4.test(data1)) {
                      validate29.errors = [{ instancePath: instancePath + "/observedAt", schemaPath: "#/properties/observedAt/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                      return false;
                    } else {
                      if (!formats0.validate(data1)) {
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
              var valid0 = _errs3 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.timezone !== void 0) {
                const _errs5 = errors2;
                if ("UTC" !== data.timezone) {
                  validate29.errors = [{ instancePath: instancePath + "/timezone", schemaPath: "#/properties/timezone/const", keyword: "const", params: { allowedValue: "UTC" }, message: "must be equal to constant" }];
                  return false;
                }
                var valid0 = _errs5 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.currency !== void 0) {
                  const _errs6 = errors2;
                  if ("USD" !== data.currency) {
                    validate29.errors = [{ instancePath: instancePath + "/currency", schemaPath: "#/properties/currency/const", keyword: "const", params: { allowedValue: "USD" }, message: "must be equal to constant" }];
                    return false;
                  }
                  var valid0 = _errs6 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.countersCoverage !== void 0) {
                    const _errs7 = errors2;
                    if ("recorded-runs-only" !== data.countersCoverage) {
                      validate29.errors = [{ instancePath: instancePath + "/countersCoverage", schemaPath: "#/properties/countersCoverage/const", keyword: "const", params: { allowedValue: "recorded-runs-only" }, message: "must be equal to constant" }];
                      return false;
                    }
                    var valid0 = _errs7 === errors2;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.policy !== void 0) {
                      let data5 = data.policy;
                      const _errs8 = errors2;
                      const _errs9 = errors2;
                      let valid1 = false;
                      let passing0 = null;
                      const _errs10 = errors2;
                      if (errors2 === _errs10) {
                        if (data5 && typeof data5 == "object" && !Array.isArray(data5)) {
                          let missing1;
                          if (data5.status === void 0 && (missing1 = "status") || data5.revision === void 0 && (missing1 = "revision") || data5.monthlyCapMicroUsd === void 0 && (missing1 = "monthlyCapMicroUsd") || data5.maxTurns === void 0 && (missing1 = "maxTurns") || data5.maxBudgetMicroUsd === void 0 && (missing1 = "maxBudgetMicroUsd")) {
                            const err0 = { instancePath: instancePath + "/policy", schemaPath: "#/properties/policy/oneOf/0/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" };
                            if (vErrors === null) {
                              vErrors = [err0];
                            } else {
                              vErrors.push(err0);
                            }
                            errors2++;
                          } else {
                            const _errs12 = errors2;
                            for (const key1 in data5) {
                              if (!(key1 === "status" || key1 === "revision" || key1 === "monthlyCapMicroUsd" || key1 === "maxTurns" || key1 === "maxBudgetMicroUsd")) {
                                const err1 = { instancePath: instancePath + "/policy", schemaPath: "#/properties/policy/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
                                if (vErrors === null) {
                                  vErrors = [err1];
                                } else {
                                  vErrors.push(err1);
                                }
                                errors2++;
                                break;
                              }
                            }
                            if (_errs12 === errors2) {
                              if (data5.status !== void 0) {
                                const _errs13 = errors2;
                                if ("configured" !== data5.status) {
                                  const err2 = { instancePath: instancePath + "/policy/status", schemaPath: "#/properties/policy/oneOf/0/properties/status/const", keyword: "const", params: { allowedValue: "configured" }, message: "must be equal to constant" };
                                  if (vErrors === null) {
                                    vErrors = [err2];
                                  } else {
                                    vErrors.push(err2);
                                  }
                                  errors2++;
                                }
                                var valid2 = _errs13 === errors2;
                              } else {
                                var valid2 = true;
                              }
                              if (valid2) {
                                if (data5.revision !== void 0) {
                                  let data7 = data5.revision;
                                  const _errs14 = errors2;
                                  if (!(typeof data7 == "number" && (!(data7 % 1) && !isNaN(data7)) && isFinite(data7))) {
                                    const err3 = { instancePath: instancePath + "/policy/revision", schemaPath: "#/properties/policy/oneOf/0/properties/revision/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                    if (vErrors === null) {
                                      vErrors = [err3];
                                    } else {
                                      vErrors.push(err3);
                                    }
                                    errors2++;
                                  }
                                  if (errors2 === _errs14) {
                                    if (typeof data7 == "number" && isFinite(data7)) {
                                      if (data7 > 9007199254740991 || isNaN(data7)) {
                                        const err4 = { instancePath: instancePath + "/policy/revision", schemaPath: "#/properties/policy/oneOf/0/properties/revision/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                        if (vErrors === null) {
                                          vErrors = [err4];
                                        } else {
                                          vErrors.push(err4);
                                        }
                                        errors2++;
                                      } else {
                                        if (data7 < 1 || isNaN(data7)) {
                                          const err5 = { instancePath: instancePath + "/policy/revision", schemaPath: "#/properties/policy/oneOf/0/properties/revision/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                                          if (vErrors === null) {
                                            vErrors = [err5];
                                          } else {
                                            vErrors.push(err5);
                                          }
                                          errors2++;
                                        }
                                      }
                                    }
                                  }
                                  var valid2 = _errs14 === errors2;
                                } else {
                                  var valid2 = true;
                                }
                                if (valid2) {
                                  if (data5.monthlyCapMicroUsd !== void 0) {
                                    let data8 = data5.monthlyCapMicroUsd;
                                    const _errs16 = errors2;
                                    if (!(typeof data8 == "number" && (!(data8 % 1) && !isNaN(data8)) && isFinite(data8))) {
                                      const err6 = { instancePath: instancePath + "/policy/monthlyCapMicroUsd", schemaPath: "#/properties/policy/oneOf/0/properties/monthlyCapMicroUsd/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                      if (vErrors === null) {
                                        vErrors = [err6];
                                      } else {
                                        vErrors.push(err6);
                                      }
                                      errors2++;
                                    }
                                    if (errors2 === _errs16) {
                                      if (typeof data8 == "number" && isFinite(data8)) {
                                        if (data8 > 9007199254740991 || isNaN(data8)) {
                                          const err7 = { instancePath: instancePath + "/policy/monthlyCapMicroUsd", schemaPath: "#/properties/policy/oneOf/0/properties/monthlyCapMicroUsd/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                          if (vErrors === null) {
                                            vErrors = [err7];
                                          } else {
                                            vErrors.push(err7);
                                          }
                                          errors2++;
                                        } else {
                                          if (data8 < 1 || isNaN(data8)) {
                                            const err8 = { instancePath: instancePath + "/policy/monthlyCapMicroUsd", schemaPath: "#/properties/policy/oneOf/0/properties/monthlyCapMicroUsd/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
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
                                    var valid2 = _errs16 === errors2;
                                  } else {
                                    var valid2 = true;
                                  }
                                  if (valid2) {
                                    if (data5.maxTurns !== void 0) {
                                      let data9 = data5.maxTurns;
                                      const _errs18 = errors2;
                                      if (!(typeof data9 == "number" && (!(data9 % 1) && !isNaN(data9)) && isFinite(data9))) {
                                        const err9 = { instancePath: instancePath + "/policy/maxTurns", schemaPath: "#/properties/policy/oneOf/0/properties/maxTurns/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                        if (vErrors === null) {
                                          vErrors = [err9];
                                        } else {
                                          vErrors.push(err9);
                                        }
                                        errors2++;
                                      }
                                      if (errors2 === _errs18) {
                                        if (typeof data9 == "number" && isFinite(data9)) {
                                          if (data9 > 100 || isNaN(data9)) {
                                            const err10 = { instancePath: instancePath + "/policy/maxTurns", schemaPath: "#/properties/policy/oneOf/0/properties/maxTurns/maximum", keyword: "maximum", params: { comparison: "<=", limit: 100 }, message: "must be <= 100" };
                                            if (vErrors === null) {
                                              vErrors = [err10];
                                            } else {
                                              vErrors.push(err10);
                                            }
                                            errors2++;
                                          } else {
                                            if (data9 < 1 || isNaN(data9)) {
                                              const err11 = { instancePath: instancePath + "/policy/maxTurns", schemaPath: "#/properties/policy/oneOf/0/properties/maxTurns/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                                              if (vErrors === null) {
                                                vErrors = [err11];
                                              } else {
                                                vErrors.push(err11);
                                              }
                                              errors2++;
                                            }
                                          }
                                        }
                                      }
                                      var valid2 = _errs18 === errors2;
                                    } else {
                                      var valid2 = true;
                                    }
                                    if (valid2) {
                                      if (data5.maxBudgetMicroUsd !== void 0) {
                                        let data10 = data5.maxBudgetMicroUsd;
                                        const _errs20 = errors2;
                                        if (!(typeof data10 == "number" && (!(data10 % 1) && !isNaN(data10)) && isFinite(data10))) {
                                          const err12 = { instancePath: instancePath + "/policy/maxBudgetMicroUsd", schemaPath: "#/properties/policy/oneOf/0/properties/maxBudgetMicroUsd/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                          if (vErrors === null) {
                                            vErrors = [err12];
                                          } else {
                                            vErrors.push(err12);
                                          }
                                          errors2++;
                                        }
                                        if (errors2 === _errs20) {
                                          if (typeof data10 == "number" && isFinite(data10)) {
                                            if (data10 > 9007199254740991 || isNaN(data10)) {
                                              const err13 = { instancePath: instancePath + "/policy/maxBudgetMicroUsd", schemaPath: "#/properties/policy/oneOf/0/properties/maxBudgetMicroUsd/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                              if (vErrors === null) {
                                                vErrors = [err13];
                                              } else {
                                                vErrors.push(err13);
                                              }
                                              errors2++;
                                            } else {
                                              if (data10 < 1 || isNaN(data10)) {
                                                const err14 = { instancePath: instancePath + "/policy/maxBudgetMicroUsd", schemaPath: "#/properties/policy/oneOf/0/properties/maxBudgetMicroUsd/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                                                if (vErrors === null) {
                                                  vErrors = [err14];
                                                } else {
                                                  vErrors.push(err14);
                                                }
                                                errors2++;
                                              }
                                            }
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
                        } else {
                          const err15 = { instancePath: instancePath + "/policy", schemaPath: "#/properties/policy/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                          if (vErrors === null) {
                            vErrors = [err15];
                          } else {
                            vErrors.push(err15);
                          }
                          errors2++;
                        }
                      }
                      var _valid0 = _errs10 === errors2;
                      if (_valid0) {
                        valid1 = true;
                        passing0 = 0;
                        var props0 = true;
                      }
                      const _errs22 = errors2;
                      if (errors2 === _errs22) {
                        if (data5 && typeof data5 == "object" && !Array.isArray(data5)) {
                          let missing2;
                          if (data5.status === void 0 && (missing2 = "status") || data5.revision === void 0 && (missing2 = "revision") || data5.monthlyCapMicroUsd === void 0 && (missing2 = "monthlyCapMicroUsd") || data5.maxTurns === void 0 && (missing2 = "maxTurns") || data5.maxBudgetMicroUsd === void 0 && (missing2 = "maxBudgetMicroUsd")) {
                            const err16 = { instancePath: instancePath + "/policy", schemaPath: "#/properties/policy/oneOf/1/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" };
                            if (vErrors === null) {
                              vErrors = [err16];
                            } else {
                              vErrors.push(err16);
                            }
                            errors2++;
                          } else {
                            const _errs24 = errors2;
                            for (const key2 in data5) {
                              if (!(key2 === "status" || key2 === "revision" || key2 === "monthlyCapMicroUsd" || key2 === "maxTurns" || key2 === "maxBudgetMicroUsd")) {
                                const err17 = { instancePath: instancePath + "/policy", schemaPath: "#/properties/policy/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
                                if (vErrors === null) {
                                  vErrors = [err17];
                                } else {
                                  vErrors.push(err17);
                                }
                                errors2++;
                                break;
                              }
                            }
                            if (_errs24 === errors2) {
                              if (data5.status !== void 0) {
                                const _errs25 = errors2;
                                if ("unavailable" !== data5.status) {
                                  const err18 = { instancePath: instancePath + "/policy/status", schemaPath: "#/properties/policy/oneOf/1/properties/status/const", keyword: "const", params: { allowedValue: "unavailable" }, message: "must be equal to constant" };
                                  if (vErrors === null) {
                                    vErrors = [err18];
                                  } else {
                                    vErrors.push(err18);
                                  }
                                  errors2++;
                                }
                                var valid3 = _errs25 === errors2;
                              } else {
                                var valid3 = true;
                              }
                              if (valid3) {
                                if (data5.revision !== void 0) {
                                  const _errs26 = errors2;
                                  if (data5.revision !== null) {
                                    const err19 = { instancePath: instancePath + "/policy/revision", schemaPath: "#/properties/policy/oneOf/1/properties/revision/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                    if (vErrors === null) {
                                      vErrors = [err19];
                                    } else {
                                      vErrors.push(err19);
                                    }
                                    errors2++;
                                  }
                                  var valid3 = _errs26 === errors2;
                                } else {
                                  var valid3 = true;
                                }
                                if (valid3) {
                                  if (data5.monthlyCapMicroUsd !== void 0) {
                                    const _errs28 = errors2;
                                    if (data5.monthlyCapMicroUsd !== null) {
                                      const err20 = { instancePath: instancePath + "/policy/monthlyCapMicroUsd", schemaPath: "#/properties/policy/oneOf/1/properties/monthlyCapMicroUsd/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                      if (vErrors === null) {
                                        vErrors = [err20];
                                      } else {
                                        vErrors.push(err20);
                                      }
                                      errors2++;
                                    }
                                    var valid3 = _errs28 === errors2;
                                  } else {
                                    var valid3 = true;
                                  }
                                  if (valid3) {
                                    if (data5.maxTurns !== void 0) {
                                      const _errs30 = errors2;
                                      if (data5.maxTurns !== null) {
                                        const err21 = { instancePath: instancePath + "/policy/maxTurns", schemaPath: "#/properties/policy/oneOf/1/properties/maxTurns/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                        if (vErrors === null) {
                                          vErrors = [err21];
                                        } else {
                                          vErrors.push(err21);
                                        }
                                        errors2++;
                                      }
                                      var valid3 = _errs30 === errors2;
                                    } else {
                                      var valid3 = true;
                                    }
                                    if (valid3) {
                                      if (data5.maxBudgetMicroUsd !== void 0) {
                                        const _errs32 = errors2;
                                        if (data5.maxBudgetMicroUsd !== null) {
                                          const err22 = { instancePath: instancePath + "/policy/maxBudgetMicroUsd", schemaPath: "#/properties/policy/oneOf/1/properties/maxBudgetMicroUsd/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                          if (vErrors === null) {
                                            vErrors = [err22];
                                          } else {
                                            vErrors.push(err22);
                                          }
                                          errors2++;
                                        }
                                        var valid3 = _errs32 === errors2;
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
                          const err23 = { instancePath: instancePath + "/policy", schemaPath: "#/properties/policy/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                          if (vErrors === null) {
                            vErrors = [err23];
                          } else {
                            vErrors.push(err23);
                          }
                          errors2++;
                        }
                      }
                      var _valid0 = _errs22 === errors2;
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
                      }
                      if (!valid1) {
                        const err24 = { instancePath: instancePath + "/policy", schemaPath: "#/properties/policy/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
                        if (vErrors === null) {
                          vErrors = [err24];
                        } else {
                          vErrors.push(err24);
                        }
                        errors2++;
                        validate29.errors = vErrors;
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
                      if (data.periods !== void 0) {
                        let data16 = data.periods;
                        const _errs34 = errors2;
                        if (errors2 === _errs34) {
                          if (Array.isArray(data16)) {
                            if (data16.length > 3) {
                              validate29.errors = [{ instancePath: instancePath + "/periods", schemaPath: "#/properties/periods/maxItems", keyword: "maxItems", params: { limit: 3 }, message: "must NOT have more than 3 items" }];
                              return false;
                            } else {
                              if (data16.length < 3) {
                                validate29.errors = [{ instancePath: instancePath + "/periods", schemaPath: "#/properties/periods/minItems", keyword: "minItems", params: { limit: 3 }, message: "must NOT have fewer than 3 items" }];
                                return false;
                              } else {
                                var valid4 = true;
                                const len0 = data16.length;
                                for (let i0 = 0; i0 < len0; i0++) {
                                  let data17 = data16[i0];
                                  const _errs36 = errors2;
                                  if (errors2 === _errs36) {
                                    if (data17 && typeof data17 == "object" && !Array.isArray(data17)) {
                                      let missing3;
                                      if (data17.kind === void 0 && (missing3 = "kind") || data17.startInclusive === void 0 && (missing3 = "startInclusive") || data17.endExclusive === void 0 && (missing3 = "endExclusive") || data17.attempts === void 0 && (missing3 = "attempts") || data17.states === void 0 && (missing3 = "states") || data17.recording === void 0 && (missing3 = "recording") || data17.knownChargeMicroUsd === void 0 && (missing3 = "knownChargeMicroUsd") || data17.recorded === void 0 && (missing3 = "recorded") || data17.conversationThreads === void 0 && (missing3 = "conversationThreads") || data17.completedAttempts === void 0 && (missing3 = "completedAttempts") || data17.partialOrFailed === void 0 && (missing3 = "partialOrFailed") || data17.liability === void 0 && (missing3 = "liability") || data17.lineage === void 0 && (missing3 = "lineage") || data17.counters === void 0 && (missing3 = "counters")) {
                                        validate29.errors = [{ instancePath: instancePath + "/periods/" + i0, schemaPath: "#/properties/periods/items/required", keyword: "required", params: { missingProperty: missing3 }, message: "must have required property '" + missing3 + "'" }];
                                        return false;
                                      } else {
                                        const _errs38 = errors2;
                                        for (const key3 in data17) {
                                          if (!func1.call(schema40.properties.periods.items.properties, key3)) {
                                            validate29.errors = [{ instancePath: instancePath + "/periods/" + i0, schemaPath: "#/properties/periods/items/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" }];
                                            return false;
                                            break;
                                          }
                                        }
                                        if (_errs38 === errors2) {
                                          if (data17.kind !== void 0) {
                                            let data18 = data17.kind;
                                            const _errs39 = errors2;
                                            if (!(data18 === "day" || data18 === "week" || data18 === "month")) {
                                              validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/kind", schemaPath: "#/properties/periods/items/properties/kind/enum", keyword: "enum", params: { allowedValues: schema40.properties.periods.items.properties.kind.enum }, message: "must be equal to one of the allowed values" }];
                                              return false;
                                            }
                                            var valid5 = _errs39 === errors2;
                                          } else {
                                            var valid5 = true;
                                          }
                                          if (valid5) {
                                            if (data17.startInclusive !== void 0) {
                                              let data19 = data17.startInclusive;
                                              const _errs40 = errors2;
                                              if (errors2 === _errs40) {
                                                if (errors2 === _errs40) {
                                                  if (typeof data19 === "string") {
                                                    if (!pattern4.test(data19)) {
                                                      validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/startInclusive", schemaPath: "#/properties/periods/items/properties/startInclusive/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                                                      return false;
                                                    } else {
                                                      if (!formats0.validate(data19)) {
                                                        validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/startInclusive", schemaPath: "#/properties/periods/items/properties/startInclusive/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                                                        return false;
                                                      }
                                                    }
                                                  } else {
                                                    validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/startInclusive", schemaPath: "#/properties/periods/items/properties/startInclusive/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                    return false;
                                                  }
                                                }
                                              }
                                              var valid5 = _errs40 === errors2;
                                            } else {
                                              var valid5 = true;
                                            }
                                            if (valid5) {
                                              if (data17.endExclusive !== void 0) {
                                                let data20 = data17.endExclusive;
                                                const _errs42 = errors2;
                                                if (errors2 === _errs42) {
                                                  if (errors2 === _errs42) {
                                                    if (typeof data20 === "string") {
                                                      if (!pattern4.test(data20)) {
                                                        validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/endExclusive", schemaPath: "#/properties/periods/items/properties/endExclusive/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                                                        return false;
                                                      } else {
                                                        if (!formats0.validate(data20)) {
                                                          validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/endExclusive", schemaPath: "#/properties/periods/items/properties/endExclusive/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                                                          return false;
                                                        }
                                                      }
                                                    } else {
                                                      validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/endExclusive", schemaPath: "#/properties/periods/items/properties/endExclusive/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                      return false;
                                                    }
                                                  }
                                                }
                                                var valid5 = _errs42 === errors2;
                                              } else {
                                                var valid5 = true;
                                              }
                                              if (valid5) {
                                                if (data17.attempts !== void 0) {
                                                  let data21 = data17.attempts;
                                                  const _errs44 = errors2;
                                                  if (!(typeof data21 == "number" && (!(data21 % 1) && !isNaN(data21)) && isFinite(data21))) {
                                                    validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/attempts", schemaPath: "#/properties/periods/items/properties/attempts/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                    return false;
                                                  }
                                                  if (errors2 === _errs44) {
                                                    if (typeof data21 == "number" && isFinite(data21)) {
                                                      if (data21 > 9007199254740991 || isNaN(data21)) {
                                                        validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/attempts", schemaPath: "#/properties/periods/items/properties/attempts/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                        return false;
                                                      } else {
                                                        if (data21 < 0 || isNaN(data21)) {
                                                          validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/attempts", schemaPath: "#/properties/periods/items/properties/attempts/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                          return false;
                                                        }
                                                      }
                                                    }
                                                  }
                                                  var valid5 = _errs44 === errors2;
                                                } else {
                                                  var valid5 = true;
                                                }
                                                if (valid5) {
                                                  if (data17.states !== void 0) {
                                                    let data22 = data17.states;
                                                    const _errs46 = errors2;
                                                    if (errors2 === _errs46) {
                                                      if (data22 && typeof data22 == "object" && !Array.isArray(data22)) {
                                                        let missing4;
                                                        if (data22.queued === void 0 && (missing4 = "queued") || data22.starting === void 0 && (missing4 = "starting") || data22.running === void 0 && (missing4 = "running") || data22["waiting-for-approval"] === void 0 && (missing4 = "waiting-for-approval") || data22.paused === void 0 && (missing4 = "paused") || data22.completed === void 0 && (missing4 = "completed") || data22.failed === void 0 && (missing4 = "failed") || data22.cancelled === void 0 && (missing4 = "cancelled")) {
                                                          validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states", schemaPath: "#/properties/periods/items/properties/states/required", keyword: "required", params: { missingProperty: missing4 }, message: "must have required property '" + missing4 + "'" }];
                                                          return false;
                                                        } else {
                                                          const _errs48 = errors2;
                                                          for (const key4 in data22) {
                                                            if (!(key4 === "queued" || key4 === "starting" || key4 === "running" || key4 === "waiting-for-approval" || key4 === "paused" || key4 === "completed" || key4 === "failed" || key4 === "cancelled")) {
                                                              validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states", schemaPath: "#/properties/periods/items/properties/states/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key4 }, message: "must NOT have additional properties" }];
                                                              return false;
                                                              break;
                                                            }
                                                          }
                                                          if (_errs48 === errors2) {
                                                            if (data22.queued !== void 0) {
                                                              let data23 = data22.queued;
                                                              const _errs49 = errors2;
                                                              if (!(typeof data23 == "number" && (!(data23 % 1) && !isNaN(data23)) && isFinite(data23))) {
                                                                validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/queued", schemaPath: "#/properties/periods/items/properties/states/properties/queued/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                return false;
                                                              }
                                                              if (errors2 === _errs49) {
                                                                if (typeof data23 == "number" && isFinite(data23)) {
                                                                  if (data23 > 9007199254740991 || isNaN(data23)) {
                                                                    validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/queued", schemaPath: "#/properties/periods/items/properties/states/properties/queued/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                    return false;
                                                                  } else {
                                                                    if (data23 < 0 || isNaN(data23)) {
                                                                      validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/queued", schemaPath: "#/properties/periods/items/properties/states/properties/queued/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                      return false;
                                                                    }
                                                                  }
                                                                }
                                                              }
                                                              var valid6 = _errs49 === errors2;
                                                            } else {
                                                              var valid6 = true;
                                                            }
                                                            if (valid6) {
                                                              if (data22.starting !== void 0) {
                                                                let data24 = data22.starting;
                                                                const _errs51 = errors2;
                                                                if (!(typeof data24 == "number" && (!(data24 % 1) && !isNaN(data24)) && isFinite(data24))) {
                                                                  validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/starting", schemaPath: "#/properties/periods/items/properties/states/properties/starting/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                  return false;
                                                                }
                                                                if (errors2 === _errs51) {
                                                                  if (typeof data24 == "number" && isFinite(data24)) {
                                                                    if (data24 > 9007199254740991 || isNaN(data24)) {
                                                                      validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/starting", schemaPath: "#/properties/periods/items/properties/states/properties/starting/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                      return false;
                                                                    } else {
                                                                      if (data24 < 0 || isNaN(data24)) {
                                                                        validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/starting", schemaPath: "#/properties/periods/items/properties/states/properties/starting/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                        return false;
                                                                      }
                                                                    }
                                                                  }
                                                                }
                                                                var valid6 = _errs51 === errors2;
                                                              } else {
                                                                var valid6 = true;
                                                              }
                                                              if (valid6) {
                                                                if (data22.running !== void 0) {
                                                                  let data25 = data22.running;
                                                                  const _errs53 = errors2;
                                                                  if (!(typeof data25 == "number" && (!(data25 % 1) && !isNaN(data25)) && isFinite(data25))) {
                                                                    validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/running", schemaPath: "#/properties/periods/items/properties/states/properties/running/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                    return false;
                                                                  }
                                                                  if (errors2 === _errs53) {
                                                                    if (typeof data25 == "number" && isFinite(data25)) {
                                                                      if (data25 > 9007199254740991 || isNaN(data25)) {
                                                                        validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/running", schemaPath: "#/properties/periods/items/properties/states/properties/running/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                        return false;
                                                                      } else {
                                                                        if (data25 < 0 || isNaN(data25)) {
                                                                          validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/running", schemaPath: "#/properties/periods/items/properties/states/properties/running/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                          return false;
                                                                        }
                                                                      }
                                                                    }
                                                                  }
                                                                  var valid6 = _errs53 === errors2;
                                                                } else {
                                                                  var valid6 = true;
                                                                }
                                                                if (valid6) {
                                                                  if (data22["waiting-for-approval"] !== void 0) {
                                                                    let data26 = data22["waiting-for-approval"];
                                                                    const _errs55 = errors2;
                                                                    if (!(typeof data26 == "number" && (!(data26 % 1) && !isNaN(data26)) && isFinite(data26))) {
                                                                      validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/waiting-for-approval", schemaPath: "#/properties/periods/items/properties/states/properties/waiting-for-approval/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                      return false;
                                                                    }
                                                                    if (errors2 === _errs55) {
                                                                      if (typeof data26 == "number" && isFinite(data26)) {
                                                                        if (data26 > 9007199254740991 || isNaN(data26)) {
                                                                          validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/waiting-for-approval", schemaPath: "#/properties/periods/items/properties/states/properties/waiting-for-approval/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                          return false;
                                                                        } else {
                                                                          if (data26 < 0 || isNaN(data26)) {
                                                                            validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/waiting-for-approval", schemaPath: "#/properties/periods/items/properties/states/properties/waiting-for-approval/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                            return false;
                                                                          }
                                                                        }
                                                                      }
                                                                    }
                                                                    var valid6 = _errs55 === errors2;
                                                                  } else {
                                                                    var valid6 = true;
                                                                  }
                                                                  if (valid6) {
                                                                    if (data22.paused !== void 0) {
                                                                      let data27 = data22.paused;
                                                                      const _errs57 = errors2;
                                                                      if (!(typeof data27 == "number" && (!(data27 % 1) && !isNaN(data27)) && isFinite(data27))) {
                                                                        validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/paused", schemaPath: "#/properties/periods/items/properties/states/properties/paused/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                        return false;
                                                                      }
                                                                      if (errors2 === _errs57) {
                                                                        if (typeof data27 == "number" && isFinite(data27)) {
                                                                          if (data27 > 9007199254740991 || isNaN(data27)) {
                                                                            validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/paused", schemaPath: "#/properties/periods/items/properties/states/properties/paused/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                            return false;
                                                                          } else {
                                                                            if (data27 < 0 || isNaN(data27)) {
                                                                              validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/paused", schemaPath: "#/properties/periods/items/properties/states/properties/paused/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                              return false;
                                                                            }
                                                                          }
                                                                        }
                                                                      }
                                                                      var valid6 = _errs57 === errors2;
                                                                    } else {
                                                                      var valid6 = true;
                                                                    }
                                                                    if (valid6) {
                                                                      if (data22.completed !== void 0) {
                                                                        let data28 = data22.completed;
                                                                        const _errs59 = errors2;
                                                                        if (!(typeof data28 == "number" && (!(data28 % 1) && !isNaN(data28)) && isFinite(data28))) {
                                                                          validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/completed", schemaPath: "#/properties/periods/items/properties/states/properties/completed/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                          return false;
                                                                        }
                                                                        if (errors2 === _errs59) {
                                                                          if (typeof data28 == "number" && isFinite(data28)) {
                                                                            if (data28 > 9007199254740991 || isNaN(data28)) {
                                                                              validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/completed", schemaPath: "#/properties/periods/items/properties/states/properties/completed/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                              return false;
                                                                            } else {
                                                                              if (data28 < 0 || isNaN(data28)) {
                                                                                validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/completed", schemaPath: "#/properties/periods/items/properties/states/properties/completed/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                return false;
                                                                              }
                                                                            }
                                                                          }
                                                                        }
                                                                        var valid6 = _errs59 === errors2;
                                                                      } else {
                                                                        var valid6 = true;
                                                                      }
                                                                      if (valid6) {
                                                                        if (data22.failed !== void 0) {
                                                                          let data29 = data22.failed;
                                                                          const _errs61 = errors2;
                                                                          if (!(typeof data29 == "number" && (!(data29 % 1) && !isNaN(data29)) && isFinite(data29))) {
                                                                            validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/failed", schemaPath: "#/properties/periods/items/properties/states/properties/failed/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                            return false;
                                                                          }
                                                                          if (errors2 === _errs61) {
                                                                            if (typeof data29 == "number" && isFinite(data29)) {
                                                                              if (data29 > 9007199254740991 || isNaN(data29)) {
                                                                                validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/failed", schemaPath: "#/properties/periods/items/properties/states/properties/failed/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                return false;
                                                                              } else {
                                                                                if (data29 < 0 || isNaN(data29)) {
                                                                                  validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/failed", schemaPath: "#/properties/periods/items/properties/states/properties/failed/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                  return false;
                                                                                }
                                                                              }
                                                                            }
                                                                          }
                                                                          var valid6 = _errs61 === errors2;
                                                                        } else {
                                                                          var valid6 = true;
                                                                        }
                                                                        if (valid6) {
                                                                          if (data22.cancelled !== void 0) {
                                                                            let data30 = data22.cancelled;
                                                                            const _errs63 = errors2;
                                                                            if (!(typeof data30 == "number" && (!(data30 % 1) && !isNaN(data30)) && isFinite(data30))) {
                                                                              validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/cancelled", schemaPath: "#/properties/periods/items/properties/states/properties/cancelled/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                              return false;
                                                                            }
                                                                            if (errors2 === _errs63) {
                                                                              if (typeof data30 == "number" && isFinite(data30)) {
                                                                                if (data30 > 9007199254740991 || isNaN(data30)) {
                                                                                  validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/cancelled", schemaPath: "#/properties/periods/items/properties/states/properties/cancelled/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                  return false;
                                                                                } else {
                                                                                  if (data30 < 0 || isNaN(data30)) {
                                                                                    validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states/cancelled", schemaPath: "#/properties/periods/items/properties/states/properties/cancelled/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                    return false;
                                                                                  }
                                                                                }
                                                                              }
                                                                            }
                                                                            var valid6 = _errs63 === errors2;
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
                                                        validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/states", schemaPath: "#/properties/periods/items/properties/states/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                        return false;
                                                      }
                                                    }
                                                    var valid5 = _errs46 === errors2;
                                                  } else {
                                                    var valid5 = true;
                                                  }
                                                  if (valid5) {
                                                    if (data17.recording !== void 0) {
                                                      let data31 = data17.recording;
                                                      const _errs65 = errors2;
                                                      if (errors2 === _errs65) {
                                                        if (data31 && typeof data31 == "object" && !Array.isArray(data31)) {
                                                          let missing5;
                                                          if (data31.recorded === void 0 && (missing5 = "recorded") || data31.unavailable === void 0 && (missing5 = "unavailable") || data31.notRecorded === void 0 && (missing5 = "notRecorded")) {
                                                            validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recording", schemaPath: "#/properties/periods/items/properties/recording/required", keyword: "required", params: { missingProperty: missing5 }, message: "must have required property '" + missing5 + "'" }];
                                                            return false;
                                                          } else {
                                                            const _errs67 = errors2;
                                                            for (const key5 in data31) {
                                                              if (!(key5 === "recorded" || key5 === "unavailable" || key5 === "notRecorded")) {
                                                                validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recording", schemaPath: "#/properties/periods/items/properties/recording/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key5 }, message: "must NOT have additional properties" }];
                                                                return false;
                                                                break;
                                                              }
                                                            }
                                                            if (_errs67 === errors2) {
                                                              if (data31.recorded !== void 0) {
                                                                let data32 = data31.recorded;
                                                                const _errs68 = errors2;
                                                                if (!(typeof data32 == "number" && (!(data32 % 1) && !isNaN(data32)) && isFinite(data32))) {
                                                                  validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recording/recorded", schemaPath: "#/properties/periods/items/properties/recording/properties/recorded/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                  return false;
                                                                }
                                                                if (errors2 === _errs68) {
                                                                  if (typeof data32 == "number" && isFinite(data32)) {
                                                                    if (data32 > 9007199254740991 || isNaN(data32)) {
                                                                      validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recording/recorded", schemaPath: "#/properties/periods/items/properties/recording/properties/recorded/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                      return false;
                                                                    } else {
                                                                      if (data32 < 0 || isNaN(data32)) {
                                                                        validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recording/recorded", schemaPath: "#/properties/periods/items/properties/recording/properties/recorded/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                        return false;
                                                                      }
                                                                    }
                                                                  }
                                                                }
                                                                var valid7 = _errs68 === errors2;
                                                              } else {
                                                                var valid7 = true;
                                                              }
                                                              if (valid7) {
                                                                if (data31.unavailable !== void 0) {
                                                                  let data33 = data31.unavailable;
                                                                  const _errs70 = errors2;
                                                                  if (!(typeof data33 == "number" && (!(data33 % 1) && !isNaN(data33)) && isFinite(data33))) {
                                                                    validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recording/unavailable", schemaPath: "#/properties/periods/items/properties/recording/properties/unavailable/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                    return false;
                                                                  }
                                                                  if (errors2 === _errs70) {
                                                                    if (typeof data33 == "number" && isFinite(data33)) {
                                                                      if (data33 > 9007199254740991 || isNaN(data33)) {
                                                                        validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recording/unavailable", schemaPath: "#/properties/periods/items/properties/recording/properties/unavailable/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                        return false;
                                                                      } else {
                                                                        if (data33 < 0 || isNaN(data33)) {
                                                                          validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recording/unavailable", schemaPath: "#/properties/periods/items/properties/recording/properties/unavailable/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                          return false;
                                                                        }
                                                                      }
                                                                    }
                                                                  }
                                                                  var valid7 = _errs70 === errors2;
                                                                } else {
                                                                  var valid7 = true;
                                                                }
                                                                if (valid7) {
                                                                  if (data31.notRecorded !== void 0) {
                                                                    let data34 = data31.notRecorded;
                                                                    const _errs72 = errors2;
                                                                    if (!(typeof data34 == "number" && (!(data34 % 1) && !isNaN(data34)) && isFinite(data34))) {
                                                                      validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recording/notRecorded", schemaPath: "#/properties/periods/items/properties/recording/properties/notRecorded/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                      return false;
                                                                    }
                                                                    if (errors2 === _errs72) {
                                                                      if (typeof data34 == "number" && isFinite(data34)) {
                                                                        if (data34 > 9007199254740991 || isNaN(data34)) {
                                                                          validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recording/notRecorded", schemaPath: "#/properties/periods/items/properties/recording/properties/notRecorded/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                          return false;
                                                                        } else {
                                                                          if (data34 < 0 || isNaN(data34)) {
                                                                            validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recording/notRecorded", schemaPath: "#/properties/periods/items/properties/recording/properties/notRecorded/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                            return false;
                                                                          }
                                                                        }
                                                                      }
                                                                    }
                                                                    var valid7 = _errs72 === errors2;
                                                                  } else {
                                                                    var valid7 = true;
                                                                  }
                                                                }
                                                              }
                                                            }
                                                          }
                                                        } else {
                                                          validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recording", schemaPath: "#/properties/periods/items/properties/recording/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                          return false;
                                                        }
                                                      }
                                                      var valid5 = _errs65 === errors2;
                                                    } else {
                                                      var valid5 = true;
                                                    }
                                                    if (valid5) {
                                                      if (data17.knownChargeMicroUsd !== void 0) {
                                                        let data35 = data17.knownChargeMicroUsd;
                                                        const _errs74 = errors2;
                                                        if (!(typeof data35 == "number" && (!(data35 % 1) && !isNaN(data35)) && isFinite(data35))) {
                                                          validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/knownChargeMicroUsd", schemaPath: "#/properties/periods/items/properties/knownChargeMicroUsd/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                          return false;
                                                        }
                                                        if (errors2 === _errs74) {
                                                          if (typeof data35 == "number" && isFinite(data35)) {
                                                            if (data35 > 9007199254740991 || isNaN(data35)) {
                                                              validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/knownChargeMicroUsd", schemaPath: "#/properties/periods/items/properties/knownChargeMicroUsd/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                              return false;
                                                            } else {
                                                              if (data35 < 0 || isNaN(data35)) {
                                                                validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/knownChargeMicroUsd", schemaPath: "#/properties/periods/items/properties/knownChargeMicroUsd/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                return false;
                                                              }
                                                            }
                                                          }
                                                        }
                                                        var valid5 = _errs74 === errors2;
                                                      } else {
                                                        var valid5 = true;
                                                      }
                                                      if (valid5) {
                                                        if (data17.recorded !== void 0) {
                                                          let data36 = data17.recorded;
                                                          const _errs76 = errors2;
                                                          if (errors2 === _errs76) {
                                                            if (data36 && typeof data36 == "object" && !Array.isArray(data36)) {
                                                              let missing6;
                                                              if (data36.queued === void 0 && (missing6 = "queued") || data36.starting === void 0 && (missing6 = "starting") || data36.running === void 0 && (missing6 = "running") || data36["waiting-for-approval"] === void 0 && (missing6 = "waiting-for-approval") || data36.paused === void 0 && (missing6 = "paused") || data36.completed === void 0 && (missing6 = "completed") || data36.failed === void 0 && (missing6 = "failed") || data36.cancelled === void 0 && (missing6 = "cancelled")) {
                                                                validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recorded", schemaPath: "#/properties/periods/items/properties/recorded/required", keyword: "required", params: { missingProperty: missing6 }, message: "must have required property '" + missing6 + "'" }];
                                                                return false;
                                                              } else {
                                                                const _errs78 = errors2;
                                                                for (const key6 in data36) {
                                                                  if (!(key6 === "queued" || key6 === "starting" || key6 === "running" || key6 === "waiting-for-approval" || key6 === "paused" || key6 === "completed" || key6 === "failed" || key6 === "cancelled")) {
                                                                    validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recorded", schemaPath: "#/properties/periods/items/properties/recorded/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key6 }, message: "must NOT have additional properties" }];
                                                                    return false;
                                                                    break;
                                                                  }
                                                                }
                                                                if (_errs78 === errors2) {
                                                                  if (data36.queued !== void 0) {
                                                                    let data37 = data36.queued;
                                                                    const _errs79 = errors2;
                                                                    if (!(typeof data37 == "number" && (!(data37 % 1) && !isNaN(data37)) && isFinite(data37))) {
                                                                      validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recorded/queued", schemaPath: "#/properties/periods/items/properties/recorded/properties/queued/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                      return false;
                                                                    }
                                                                    if (errors2 === _errs79) {
                                                                      if (typeof data37 == "number" && isFinite(data37)) {
                                                                        if (data37 > 9007199254740991 || isNaN(data37)) {
                                                                          validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recorded/queued", schemaPath: "#/properties/periods/items/properties/recorded/properties/queued/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                          return false;
                                                                        } else {
                                                                          if (data37 < 0 || isNaN(data37)) {
                                                                            validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recorded/queued", schemaPath: "#/properties/periods/items/properties/recorded/properties/queued/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                            return false;
                                                                          }
                                                                        }
                                                                      }
                                                                    }
                                                                    var valid8 = _errs79 === errors2;
                                                                  } else {
                                                                    var valid8 = true;
                                                                  }
                                                                  if (valid8) {
                                                                    if (data36.starting !== void 0) {
                                                                      let data38 = data36.starting;
                                                                      const _errs81 = errors2;
                                                                      if (!(typeof data38 == "number" && (!(data38 % 1) && !isNaN(data38)) && isFinite(data38))) {
                                                                        validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recorded/starting", schemaPath: "#/properties/periods/items/properties/recorded/properties/starting/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                        return false;
                                                                      }
                                                                      if (errors2 === _errs81) {
                                                                        if (typeof data38 == "number" && isFinite(data38)) {
                                                                          if (data38 > 9007199254740991 || isNaN(data38)) {
                                                                            validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recorded/starting", schemaPath: "#/properties/periods/items/properties/recorded/properties/starting/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                            return false;
                                                                          } else {
                                                                            if (data38 < 0 || isNaN(data38)) {
                                                                              validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recorded/starting", schemaPath: "#/properties/periods/items/properties/recorded/properties/starting/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                              return false;
                                                                            }
                                                                          }
                                                                        }
                                                                      }
                                                                      var valid8 = _errs81 === errors2;
                                                                    } else {
                                                                      var valid8 = true;
                                                                    }
                                                                    if (valid8) {
                                                                      if (data36.running !== void 0) {
                                                                        let data39 = data36.running;
                                                                        const _errs83 = errors2;
                                                                        if (!(typeof data39 == "number" && (!(data39 % 1) && !isNaN(data39)) && isFinite(data39))) {
                                                                          validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recorded/running", schemaPath: "#/properties/periods/items/properties/recorded/properties/running/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                          return false;
                                                                        }
                                                                        if (errors2 === _errs83) {
                                                                          if (typeof data39 == "number" && isFinite(data39)) {
                                                                            if (data39 > 9007199254740991 || isNaN(data39)) {
                                                                              validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recorded/running", schemaPath: "#/properties/periods/items/properties/recorded/properties/running/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                              return false;
                                                                            } else {
                                                                              if (data39 < 0 || isNaN(data39)) {
                                                                                validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recorded/running", schemaPath: "#/properties/periods/items/properties/recorded/properties/running/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                return false;
                                                                              }
                                                                            }
                                                                          }
                                                                        }
                                                                        var valid8 = _errs83 === errors2;
                                                                      } else {
                                                                        var valid8 = true;
                                                                      }
                                                                      if (valid8) {
                                                                        if (data36["waiting-for-approval"] !== void 0) {
                                                                          let data40 = data36["waiting-for-approval"];
                                                                          const _errs85 = errors2;
                                                                          if (!(typeof data40 == "number" && (!(data40 % 1) && !isNaN(data40)) && isFinite(data40))) {
                                                                            validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recorded/waiting-for-approval", schemaPath: "#/properties/periods/items/properties/recorded/properties/waiting-for-approval/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                            return false;
                                                                          }
                                                                          if (errors2 === _errs85) {
                                                                            if (typeof data40 == "number" && isFinite(data40)) {
                                                                              if (data40 > 9007199254740991 || isNaN(data40)) {
                                                                                validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recorded/waiting-for-approval", schemaPath: "#/properties/periods/items/properties/recorded/properties/waiting-for-approval/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                return false;
                                                                              } else {
                                                                                if (data40 < 0 || isNaN(data40)) {
                                                                                  validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recorded/waiting-for-approval", schemaPath: "#/properties/periods/items/properties/recorded/properties/waiting-for-approval/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                  return false;
                                                                                }
                                                                              }
                                                                            }
                                                                          }
                                                                          var valid8 = _errs85 === errors2;
                                                                        } else {
                                                                          var valid8 = true;
                                                                        }
                                                                        if (valid8) {
                                                                          if (data36.paused !== void 0) {
                                                                            let data41 = data36.paused;
                                                                            const _errs87 = errors2;
                                                                            if (!(typeof data41 == "number" && (!(data41 % 1) && !isNaN(data41)) && isFinite(data41))) {
                                                                              validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recorded/paused", schemaPath: "#/properties/periods/items/properties/recorded/properties/paused/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                              return false;
                                                                            }
                                                                            if (errors2 === _errs87) {
                                                                              if (typeof data41 == "number" && isFinite(data41)) {
                                                                                if (data41 > 9007199254740991 || isNaN(data41)) {
                                                                                  validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recorded/paused", schemaPath: "#/properties/periods/items/properties/recorded/properties/paused/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                  return false;
                                                                                } else {
                                                                                  if (data41 < 0 || isNaN(data41)) {
                                                                                    validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recorded/paused", schemaPath: "#/properties/periods/items/properties/recorded/properties/paused/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                    return false;
                                                                                  }
                                                                                }
                                                                              }
                                                                            }
                                                                            var valid8 = _errs87 === errors2;
                                                                          } else {
                                                                            var valid8 = true;
                                                                          }
                                                                          if (valid8) {
                                                                            if (data36.completed !== void 0) {
                                                                              let data42 = data36.completed;
                                                                              const _errs89 = errors2;
                                                                              if (!(typeof data42 == "number" && (!(data42 % 1) && !isNaN(data42)) && isFinite(data42))) {
                                                                                validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recorded/completed", schemaPath: "#/properties/periods/items/properties/recorded/properties/completed/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                return false;
                                                                              }
                                                                              if (errors2 === _errs89) {
                                                                                if (typeof data42 == "number" && isFinite(data42)) {
                                                                                  if (data42 > 9007199254740991 || isNaN(data42)) {
                                                                                    validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recorded/completed", schemaPath: "#/properties/periods/items/properties/recorded/properties/completed/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                    return false;
                                                                                  } else {
                                                                                    if (data42 < 0 || isNaN(data42)) {
                                                                                      validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recorded/completed", schemaPath: "#/properties/periods/items/properties/recorded/properties/completed/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                      return false;
                                                                                    }
                                                                                  }
                                                                                }
                                                                              }
                                                                              var valid8 = _errs89 === errors2;
                                                                            } else {
                                                                              var valid8 = true;
                                                                            }
                                                                            if (valid8) {
                                                                              if (data36.failed !== void 0) {
                                                                                let data43 = data36.failed;
                                                                                const _errs91 = errors2;
                                                                                if (!(typeof data43 == "number" && (!(data43 % 1) && !isNaN(data43)) && isFinite(data43))) {
                                                                                  validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recorded/failed", schemaPath: "#/properties/periods/items/properties/recorded/properties/failed/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                  return false;
                                                                                }
                                                                                if (errors2 === _errs91) {
                                                                                  if (typeof data43 == "number" && isFinite(data43)) {
                                                                                    if (data43 > 9007199254740991 || isNaN(data43)) {
                                                                                      validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recorded/failed", schemaPath: "#/properties/periods/items/properties/recorded/properties/failed/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                      return false;
                                                                                    } else {
                                                                                      if (data43 < 0 || isNaN(data43)) {
                                                                                        validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recorded/failed", schemaPath: "#/properties/periods/items/properties/recorded/properties/failed/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                        return false;
                                                                                      }
                                                                                    }
                                                                                  }
                                                                                }
                                                                                var valid8 = _errs91 === errors2;
                                                                              } else {
                                                                                var valid8 = true;
                                                                              }
                                                                              if (valid8) {
                                                                                if (data36.cancelled !== void 0) {
                                                                                  let data44 = data36.cancelled;
                                                                                  const _errs93 = errors2;
                                                                                  if (!(typeof data44 == "number" && (!(data44 % 1) && !isNaN(data44)) && isFinite(data44))) {
                                                                                    validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recorded/cancelled", schemaPath: "#/properties/periods/items/properties/recorded/properties/cancelled/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                    return false;
                                                                                  }
                                                                                  if (errors2 === _errs93) {
                                                                                    if (typeof data44 == "number" && isFinite(data44)) {
                                                                                      if (data44 > 9007199254740991 || isNaN(data44)) {
                                                                                        validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recorded/cancelled", schemaPath: "#/properties/periods/items/properties/recorded/properties/cancelled/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                        return false;
                                                                                      } else {
                                                                                        if (data44 < 0 || isNaN(data44)) {
                                                                                          validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recorded/cancelled", schemaPath: "#/properties/periods/items/properties/recorded/properties/cancelled/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                          return false;
                                                                                        }
                                                                                      }
                                                                                    }
                                                                                  }
                                                                                  var valid8 = _errs93 === errors2;
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
                                                              validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/recorded", schemaPath: "#/properties/periods/items/properties/recorded/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                              return false;
                                                            }
                                                          }
                                                          var valid5 = _errs76 === errors2;
                                                        } else {
                                                          var valid5 = true;
                                                        }
                                                        if (valid5) {
                                                          if (data17.conversationThreads !== void 0) {
                                                            let data45 = data17.conversationThreads;
                                                            const _errs95 = errors2;
                                                            if (errors2 === _errs95) {
                                                              if (data45 && typeof data45 == "object" && !Array.isArray(data45)) {
                                                                let missing7;
                                                                if (data45.status === void 0 && (missing7 = "status") || data45.basis === void 0 && (missing7 = "basis") || data45.threads === void 0 && (missing7 = "threads") || data45.attempts === void 0 && (missing7 = "attempts")) {
                                                                  validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/conversationThreads", schemaPath: "#/properties/periods/items/properties/conversationThreads/required", keyword: "required", params: { missingProperty: missing7 }, message: "must have required property '" + missing7 + "'" }];
                                                                  return false;
                                                                } else {
                                                                  const _errs97 = errors2;
                                                                  for (const key7 in data45) {
                                                                    if (!(key7 === "status" || key7 === "basis" || key7 === "threads" || key7 === "attempts")) {
                                                                      validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/conversationThreads", schemaPath: "#/properties/periods/items/properties/conversationThreads/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key7 }, message: "must NOT have additional properties" }];
                                                                      return false;
                                                                      break;
                                                                    }
                                                                  }
                                                                  if (_errs97 === errors2) {
                                                                    if (data45.status !== void 0) {
                                                                      let data46 = data45.status;
                                                                      const _errs98 = errors2;
                                                                      if (!(data46 === "measured" || data46 === "unavailable")) {
                                                                        validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/conversationThreads/status", schemaPath: "#/properties/periods/items/properties/conversationThreads/properties/status/enum", keyword: "enum", params: { allowedValues: schema40.properties.periods.items.properties.conversationThreads.properties.status.enum }, message: "must be equal to one of the allowed values" }];
                                                                        return false;
                                                                      }
                                                                      var valid9 = _errs98 === errors2;
                                                                    } else {
                                                                      var valid9 = true;
                                                                    }
                                                                    if (valid9) {
                                                                      if (data45.basis !== void 0) {
                                                                        const _errs99 = errors2;
                                                                        if ("distinct-conversation-id-by-run-created-at" !== data45.basis) {
                                                                          validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/conversationThreads/basis", schemaPath: "#/properties/periods/items/properties/conversationThreads/properties/basis/const", keyword: "const", params: { allowedValue: "distinct-conversation-id-by-run-created-at" }, message: "must be equal to constant" }];
                                                                          return false;
                                                                        }
                                                                        var valid9 = _errs99 === errors2;
                                                                      } else {
                                                                        var valid9 = true;
                                                                      }
                                                                      if (valid9) {
                                                                        if (data45.threads !== void 0) {
                                                                          let data48 = data45.threads;
                                                                          const _errs100 = errors2;
                                                                          const _errs101 = errors2;
                                                                          let valid10 = false;
                                                                          const _errs102 = errors2;
                                                                          if (!(typeof data48 == "number" && (!(data48 % 1) && !isNaN(data48)) && isFinite(data48))) {
                                                                            const err25 = { instancePath: instancePath + "/periods/" + i0 + "/conversationThreads/threads", schemaPath: "#/properties/periods/items/properties/conversationThreads/properties/threads/anyOf/0/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                                                            if (vErrors === null) {
                                                                              vErrors = [err25];
                                                                            } else {
                                                                              vErrors.push(err25);
                                                                            }
                                                                            errors2++;
                                                                          }
                                                                          if (errors2 === _errs102) {
                                                                            if (typeof data48 == "number" && isFinite(data48)) {
                                                                              if (data48 > 9007199254740991 || isNaN(data48)) {
                                                                                const err26 = { instancePath: instancePath + "/periods/" + i0 + "/conversationThreads/threads", schemaPath: "#/properties/periods/items/properties/conversationThreads/properties/threads/anyOf/0/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                                                                if (vErrors === null) {
                                                                                  vErrors = [err26];
                                                                                } else {
                                                                                  vErrors.push(err26);
                                                                                }
                                                                                errors2++;
                                                                              } else {
                                                                                if (data48 < 0 || isNaN(data48)) {
                                                                                  const err27 = { instancePath: instancePath + "/periods/" + i0 + "/conversationThreads/threads", schemaPath: "#/properties/periods/items/properties/conversationThreads/properties/threads/anyOf/0/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
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
                                                                          var _valid1 = _errs102 === errors2;
                                                                          valid10 = valid10 || _valid1;
                                                                          const _errs104 = errors2;
                                                                          if (data48 !== null) {
                                                                            const err28 = { instancePath: instancePath + "/periods/" + i0 + "/conversationThreads/threads", schemaPath: "#/properties/periods/items/properties/conversationThreads/properties/threads/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                                                            if (vErrors === null) {
                                                                              vErrors = [err28];
                                                                            } else {
                                                                              vErrors.push(err28);
                                                                            }
                                                                            errors2++;
                                                                          }
                                                                          var _valid1 = _errs104 === errors2;
                                                                          valid10 = valid10 || _valid1;
                                                                          if (!valid10) {
                                                                            const err29 = { instancePath: instancePath + "/periods/" + i0 + "/conversationThreads/threads", schemaPath: "#/properties/periods/items/properties/conversationThreads/properties/threads/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                                                            if (vErrors === null) {
                                                                              vErrors = [err29];
                                                                            } else {
                                                                              vErrors.push(err29);
                                                                            }
                                                                            errors2++;
                                                                            validate29.errors = vErrors;
                                                                            return false;
                                                                          } else {
                                                                            errors2 = _errs101;
                                                                            if (vErrors !== null) {
                                                                              if (_errs101) {
                                                                                vErrors.length = _errs101;
                                                                              } else {
                                                                                vErrors = null;
                                                                              }
                                                                            }
                                                                          }
                                                                          var valid9 = _errs100 === errors2;
                                                                        } else {
                                                                          var valid9 = true;
                                                                        }
                                                                        if (valid9) {
                                                                          if (data45.attempts !== void 0) {
                                                                            let data49 = data45.attempts;
                                                                            const _errs106 = errors2;
                                                                            const _errs107 = errors2;
                                                                            let valid11 = false;
                                                                            const _errs108 = errors2;
                                                                            if (!(typeof data49 == "number" && (!(data49 % 1) && !isNaN(data49)) && isFinite(data49))) {
                                                                              const err30 = { instancePath: instancePath + "/periods/" + i0 + "/conversationThreads/attempts", schemaPath: "#/properties/periods/items/properties/conversationThreads/properties/attempts/anyOf/0/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                                                              if (vErrors === null) {
                                                                                vErrors = [err30];
                                                                              } else {
                                                                                vErrors.push(err30);
                                                                              }
                                                                              errors2++;
                                                                            }
                                                                            if (errors2 === _errs108) {
                                                                              if (typeof data49 == "number" && isFinite(data49)) {
                                                                                if (data49 > 9007199254740991 || isNaN(data49)) {
                                                                                  const err31 = { instancePath: instancePath + "/periods/" + i0 + "/conversationThreads/attempts", schemaPath: "#/properties/periods/items/properties/conversationThreads/properties/attempts/anyOf/0/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                                                                  if (vErrors === null) {
                                                                                    vErrors = [err31];
                                                                                  } else {
                                                                                    vErrors.push(err31);
                                                                                  }
                                                                                  errors2++;
                                                                                } else {
                                                                                  if (data49 < 0 || isNaN(data49)) {
                                                                                    const err32 = { instancePath: instancePath + "/periods/" + i0 + "/conversationThreads/attempts", schemaPath: "#/properties/periods/items/properties/conversationThreads/properties/attempts/anyOf/0/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
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
                                                                            var _valid2 = _errs108 === errors2;
                                                                            valid11 = valid11 || _valid2;
                                                                            const _errs110 = errors2;
                                                                            if (data49 !== null) {
                                                                              const err33 = { instancePath: instancePath + "/periods/" + i0 + "/conversationThreads/attempts", schemaPath: "#/properties/periods/items/properties/conversationThreads/properties/attempts/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                                                              if (vErrors === null) {
                                                                                vErrors = [err33];
                                                                              } else {
                                                                                vErrors.push(err33);
                                                                              }
                                                                              errors2++;
                                                                            }
                                                                            var _valid2 = _errs110 === errors2;
                                                                            valid11 = valid11 || _valid2;
                                                                            if (!valid11) {
                                                                              const err34 = { instancePath: instancePath + "/periods/" + i0 + "/conversationThreads/attempts", schemaPath: "#/properties/periods/items/properties/conversationThreads/properties/attempts/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                                                              if (vErrors === null) {
                                                                                vErrors = [err34];
                                                                              } else {
                                                                                vErrors.push(err34);
                                                                              }
                                                                              errors2++;
                                                                              validate29.errors = vErrors;
                                                                              return false;
                                                                            } else {
                                                                              errors2 = _errs107;
                                                                              if (vErrors !== null) {
                                                                                if (_errs107) {
                                                                                  vErrors.length = _errs107;
                                                                                } else {
                                                                                  vErrors = null;
                                                                                }
                                                                              }
                                                                            }
                                                                            var valid9 = _errs106 === errors2;
                                                                          } else {
                                                                            var valid9 = true;
                                                                          }
                                                                        }
                                                                      }
                                                                    }
                                                                  }
                                                                }
                                                              } else {
                                                                validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/conversationThreads", schemaPath: "#/properties/periods/items/properties/conversationThreads/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                                return false;
                                                              }
                                                            }
                                                            var valid5 = _errs95 === errors2;
                                                          } else {
                                                            var valid5 = true;
                                                          }
                                                          if (valid5) {
                                                            if (data17.completedAttempts !== void 0) {
                                                              let data50 = data17.completedAttempts;
                                                              const _errs112 = errors2;
                                                              if (errors2 === _errs112) {
                                                                if (data50 && typeof data50 == "object" && !Array.isArray(data50)) {
                                                                  let missing8;
                                                                  if (data50.status === void 0 && (missing8 = "status") || data50.chargeBasis === void 0 && (missing8 = "chargeBasis") || data50.jobIdentity === void 0 && (missing8 = "jobIdentity") || data50.attempts === void 0 && (missing8 = "attempts") || data50.knownChargeMicroUsd === void 0 && (missing8 = "knownChargeMicroUsd") || data50.microUsdPerCompletedAttempt === void 0 && (missing8 = "microUsdPerCompletedAttempt") || data50.attemptsWithoutRecordedUsage === void 0 && (missing8 = "attemptsWithoutRecordedUsage")) {
                                                                    validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/completedAttempts", schemaPath: "#/properties/periods/items/properties/completedAttempts/required", keyword: "required", params: { missingProperty: missing8 }, message: "must have required property '" + missing8 + "'" }];
                                                                    return false;
                                                                  } else {
                                                                    const _errs114 = errors2;
                                                                    for (const key8 in data50) {
                                                                      if (!(key8 === "status" || key8 === "chargeBasis" || key8 === "jobIdentity" || key8 === "attempts" || key8 === "knownChargeMicroUsd" || key8 === "microUsdPerCompletedAttempt" || key8 === "attemptsWithoutRecordedUsage")) {
                                                                        validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/completedAttempts", schemaPath: "#/properties/periods/items/properties/completedAttempts/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key8 }, message: "must NOT have additional properties" }];
                                                                        return false;
                                                                        break;
                                                                      }
                                                                    }
                                                                    if (_errs114 === errors2) {
                                                                      if (data50.status !== void 0) {
                                                                        let data51 = data50.status;
                                                                        const _errs115 = errors2;
                                                                        if (!(data51 === "estimated" || data51 === "unavailable")) {
                                                                          validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/completedAttempts/status", schemaPath: "#/properties/periods/items/properties/completedAttempts/properties/status/enum", keyword: "enum", params: { allowedValues: schema40.properties.periods.items.properties.completedAttempts.properties.status.enum }, message: "must be equal to one of the allowed values" }];
                                                                          return false;
                                                                        }
                                                                        var valid12 = _errs115 === errors2;
                                                                      } else {
                                                                        var valid12 = true;
                                                                      }
                                                                      if (valid12) {
                                                                        if (data50.chargeBasis !== void 0) {
                                                                          const _errs116 = errors2;
                                                                          if ("sdk-list-estimate" !== data50.chargeBasis) {
                                                                            validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/completedAttempts/chargeBasis", schemaPath: "#/properties/periods/items/properties/completedAttempts/properties/chargeBasis/const", keyword: "const", params: { allowedValue: "sdk-list-estimate" }, message: "must be equal to constant" }];
                                                                            return false;
                                                                          }
                                                                          var valid12 = _errs116 === errors2;
                                                                        } else {
                                                                          var valid12 = true;
                                                                        }
                                                                        if (valid12) {
                                                                          if (data50.jobIdentity !== void 0) {
                                                                            const _errs117 = errors2;
                                                                            if ("not-a-job-denominator" !== data50.jobIdentity) {
                                                                              validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/completedAttempts/jobIdentity", schemaPath: "#/properties/periods/items/properties/completedAttempts/properties/jobIdentity/const", keyword: "const", params: { allowedValue: "not-a-job-denominator" }, message: "must be equal to constant" }];
                                                                              return false;
                                                                            }
                                                                            var valid12 = _errs117 === errors2;
                                                                          } else {
                                                                            var valid12 = true;
                                                                          }
                                                                          if (valid12) {
                                                                            if (data50.attempts !== void 0) {
                                                                              let data54 = data50.attempts;
                                                                              const _errs118 = errors2;
                                                                              if (!(typeof data54 == "number" && (!(data54 % 1) && !isNaN(data54)) && isFinite(data54))) {
                                                                                validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/completedAttempts/attempts", schemaPath: "#/properties/periods/items/properties/completedAttempts/properties/attempts/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                return false;
                                                                              }
                                                                              if (errors2 === _errs118) {
                                                                                if (typeof data54 == "number" && isFinite(data54)) {
                                                                                  if (data54 > 9007199254740991 || isNaN(data54)) {
                                                                                    validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/completedAttempts/attempts", schemaPath: "#/properties/periods/items/properties/completedAttempts/properties/attempts/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                    return false;
                                                                                  } else {
                                                                                    if (data54 < 0 || isNaN(data54)) {
                                                                                      validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/completedAttempts/attempts", schemaPath: "#/properties/periods/items/properties/completedAttempts/properties/attempts/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                      return false;
                                                                                    }
                                                                                  }
                                                                                }
                                                                              }
                                                                              var valid12 = _errs118 === errors2;
                                                                            } else {
                                                                              var valid12 = true;
                                                                            }
                                                                            if (valid12) {
                                                                              if (data50.knownChargeMicroUsd !== void 0) {
                                                                                let data55 = data50.knownChargeMicroUsd;
                                                                                const _errs120 = errors2;
                                                                                if (!(typeof data55 == "number" && (!(data55 % 1) && !isNaN(data55)) && isFinite(data55))) {
                                                                                  validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/completedAttempts/knownChargeMicroUsd", schemaPath: "#/properties/periods/items/properties/completedAttempts/properties/knownChargeMicroUsd/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                  return false;
                                                                                }
                                                                                if (errors2 === _errs120) {
                                                                                  if (typeof data55 == "number" && isFinite(data55)) {
                                                                                    if (data55 > 9007199254740991 || isNaN(data55)) {
                                                                                      validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/completedAttempts/knownChargeMicroUsd", schemaPath: "#/properties/periods/items/properties/completedAttempts/properties/knownChargeMicroUsd/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                      return false;
                                                                                    } else {
                                                                                      if (data55 < 0 || isNaN(data55)) {
                                                                                        validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/completedAttempts/knownChargeMicroUsd", schemaPath: "#/properties/periods/items/properties/completedAttempts/properties/knownChargeMicroUsd/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                        return false;
                                                                                      }
                                                                                    }
                                                                                  }
                                                                                }
                                                                                var valid12 = _errs120 === errors2;
                                                                              } else {
                                                                                var valid12 = true;
                                                                              }
                                                                              if (valid12) {
                                                                                if (data50.microUsdPerCompletedAttempt !== void 0) {
                                                                                  let data56 = data50.microUsdPerCompletedAttempt;
                                                                                  const _errs122 = errors2;
                                                                                  const _errs123 = errors2;
                                                                                  let valid13 = false;
                                                                                  const _errs124 = errors2;
                                                                                  if (errors2 === _errs124) {
                                                                                    if (typeof data56 == "number" && isFinite(data56)) {
                                                                                      if (data56 > 9007199254740992e-6 || isNaN(data56)) {
                                                                                        const err35 = { instancePath: instancePath + "/periods/" + i0 + "/completedAttempts/microUsdPerCompletedAttempt", schemaPath: "#/properties/periods/items/properties/completedAttempts/properties/microUsdPerCompletedAttempt/anyOf/0/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740992e-6 }, message: "must be <= 9007199254.740992" };
                                                                                        if (vErrors === null) {
                                                                                          vErrors = [err35];
                                                                                        } else {
                                                                                          vErrors.push(err35);
                                                                                        }
                                                                                        errors2++;
                                                                                      } else {
                                                                                        if (data56 < 0 || isNaN(data56)) {
                                                                                          const err36 = { instancePath: instancePath + "/periods/" + i0 + "/completedAttempts/microUsdPerCompletedAttempt", schemaPath: "#/properties/periods/items/properties/completedAttempts/properties/microUsdPerCompletedAttempt/anyOf/0/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                                                                          if (vErrors === null) {
                                                                                            vErrors = [err36];
                                                                                          } else {
                                                                                            vErrors.push(err36);
                                                                                          }
                                                                                          errors2++;
                                                                                        }
                                                                                      }
                                                                                    } else {
                                                                                      const err37 = { instancePath: instancePath + "/periods/" + i0 + "/completedAttempts/microUsdPerCompletedAttempt", schemaPath: "#/properties/periods/items/properties/completedAttempts/properties/microUsdPerCompletedAttempt/anyOf/0/type", keyword: "type", params: { type: "number" }, message: "must be number" };
                                                                                      if (vErrors === null) {
                                                                                        vErrors = [err37];
                                                                                      } else {
                                                                                        vErrors.push(err37);
                                                                                      }
                                                                                      errors2++;
                                                                                    }
                                                                                  }
                                                                                  var _valid3 = _errs124 === errors2;
                                                                                  valid13 = valid13 || _valid3;
                                                                                  const _errs126 = errors2;
                                                                                  if (data56 !== null) {
                                                                                    const err38 = { instancePath: instancePath + "/periods/" + i0 + "/completedAttempts/microUsdPerCompletedAttempt", schemaPath: "#/properties/periods/items/properties/completedAttempts/properties/microUsdPerCompletedAttempt/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                                                                    if (vErrors === null) {
                                                                                      vErrors = [err38];
                                                                                    } else {
                                                                                      vErrors.push(err38);
                                                                                    }
                                                                                    errors2++;
                                                                                  }
                                                                                  var _valid3 = _errs126 === errors2;
                                                                                  valid13 = valid13 || _valid3;
                                                                                  if (!valid13) {
                                                                                    const err39 = { instancePath: instancePath + "/periods/" + i0 + "/completedAttempts/microUsdPerCompletedAttempt", schemaPath: "#/properties/periods/items/properties/completedAttempts/properties/microUsdPerCompletedAttempt/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                                                                    if (vErrors === null) {
                                                                                      vErrors = [err39];
                                                                                    } else {
                                                                                      vErrors.push(err39);
                                                                                    }
                                                                                    errors2++;
                                                                                    validate29.errors = vErrors;
                                                                                    return false;
                                                                                  } else {
                                                                                    errors2 = _errs123;
                                                                                    if (vErrors !== null) {
                                                                                      if (_errs123) {
                                                                                        vErrors.length = _errs123;
                                                                                      } else {
                                                                                        vErrors = null;
                                                                                      }
                                                                                    }
                                                                                  }
                                                                                  var valid12 = _errs122 === errors2;
                                                                                } else {
                                                                                  var valid12 = true;
                                                                                }
                                                                                if (valid12) {
                                                                                  if (data50.attemptsWithoutRecordedUsage !== void 0) {
                                                                                    let data57 = data50.attemptsWithoutRecordedUsage;
                                                                                    const _errs128 = errors2;
                                                                                    if (!(typeof data57 == "number" && (!(data57 % 1) && !isNaN(data57)) && isFinite(data57))) {
                                                                                      validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/completedAttempts/attemptsWithoutRecordedUsage", schemaPath: "#/properties/periods/items/properties/completedAttempts/properties/attemptsWithoutRecordedUsage/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                      return false;
                                                                                    }
                                                                                    if (errors2 === _errs128) {
                                                                                      if (typeof data57 == "number" && isFinite(data57)) {
                                                                                        if (data57 > 9007199254740991 || isNaN(data57)) {
                                                                                          validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/completedAttempts/attemptsWithoutRecordedUsage", schemaPath: "#/properties/periods/items/properties/completedAttempts/properties/attemptsWithoutRecordedUsage/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                          return false;
                                                                                        } else {
                                                                                          if (data57 < 0 || isNaN(data57)) {
                                                                                            validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/completedAttempts/attemptsWithoutRecordedUsage", schemaPath: "#/properties/periods/items/properties/completedAttempts/properties/attemptsWithoutRecordedUsage/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                            return false;
                                                                                          }
                                                                                        }
                                                                                      }
                                                                                    }
                                                                                    var valid12 = _errs128 === errors2;
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
                                                                } else {
                                                                  validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/completedAttempts", schemaPath: "#/properties/periods/items/properties/completedAttempts/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                                  return false;
                                                                }
                                                              }
                                                              var valid5 = _errs112 === errors2;
                                                            } else {
                                                              var valid5 = true;
                                                            }
                                                            if (valid5) {
                                                              if (data17.partialOrFailed !== void 0) {
                                                                let data58 = data17.partialOrFailed;
                                                                const _errs130 = errors2;
                                                                if (errors2 === _errs130) {
                                                                  if (data58 && typeof data58 == "object" && !Array.isArray(data58)) {
                                                                    let missing9;
                                                                    if (data58.status === void 0 && (missing9 = "status") || data58.chargeBasis === void 0 && (missing9 = "chargeBasis") || data58.failedAttempts === void 0 && (missing9 = "failedAttempts") || data58.cancelledAttempts === void 0 && (missing9 = "cancelledAttempts") || data58.recordedAttempts === void 0 && (missing9 = "recordedAttempts") || data58.knownChargeMicroUsd === void 0 && (missing9 = "knownChargeMicroUsd") || data58.microUsdPerRecordedAttempt === void 0 && (missing9 = "microUsdPerRecordedAttempt")) {
                                                                      validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/partialOrFailed", schemaPath: "#/properties/periods/items/properties/partialOrFailed/required", keyword: "required", params: { missingProperty: missing9 }, message: "must have required property '" + missing9 + "'" }];
                                                                      return false;
                                                                    } else {
                                                                      const _errs132 = errors2;
                                                                      for (const key9 in data58) {
                                                                        if (!(key9 === "status" || key9 === "chargeBasis" || key9 === "failedAttempts" || key9 === "cancelledAttempts" || key9 === "recordedAttempts" || key9 === "knownChargeMicroUsd" || key9 === "microUsdPerRecordedAttempt")) {
                                                                          validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/partialOrFailed", schemaPath: "#/properties/periods/items/properties/partialOrFailed/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key9 }, message: "must NOT have additional properties" }];
                                                                          return false;
                                                                          break;
                                                                        }
                                                                      }
                                                                      if (_errs132 === errors2) {
                                                                        if (data58.status !== void 0) {
                                                                          let data59 = data58.status;
                                                                          const _errs133 = errors2;
                                                                          if (!(data59 === "estimated" || data59 === "unavailable")) {
                                                                            validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/partialOrFailed/status", schemaPath: "#/properties/periods/items/properties/partialOrFailed/properties/status/enum", keyword: "enum", params: { allowedValues: schema40.properties.periods.items.properties.partialOrFailed.properties.status.enum }, message: "must be equal to one of the allowed values" }];
                                                                            return false;
                                                                          }
                                                                          var valid14 = _errs133 === errors2;
                                                                        } else {
                                                                          var valid14 = true;
                                                                        }
                                                                        if (valid14) {
                                                                          if (data58.chargeBasis !== void 0) {
                                                                            const _errs134 = errors2;
                                                                            if ("sdk-list-estimate" !== data58.chargeBasis) {
                                                                              validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/partialOrFailed/chargeBasis", schemaPath: "#/properties/periods/items/properties/partialOrFailed/properties/chargeBasis/const", keyword: "const", params: { allowedValue: "sdk-list-estimate" }, message: "must be equal to constant" }];
                                                                              return false;
                                                                            }
                                                                            var valid14 = _errs134 === errors2;
                                                                          } else {
                                                                            var valid14 = true;
                                                                          }
                                                                          if (valid14) {
                                                                            if (data58.failedAttempts !== void 0) {
                                                                              let data61 = data58.failedAttempts;
                                                                              const _errs135 = errors2;
                                                                              if (!(typeof data61 == "number" && (!(data61 % 1) && !isNaN(data61)) && isFinite(data61))) {
                                                                                validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/partialOrFailed/failedAttempts", schemaPath: "#/properties/periods/items/properties/partialOrFailed/properties/failedAttempts/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                return false;
                                                                              }
                                                                              if (errors2 === _errs135) {
                                                                                if (typeof data61 == "number" && isFinite(data61)) {
                                                                                  if (data61 > 9007199254740991 || isNaN(data61)) {
                                                                                    validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/partialOrFailed/failedAttempts", schemaPath: "#/properties/periods/items/properties/partialOrFailed/properties/failedAttempts/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                    return false;
                                                                                  } else {
                                                                                    if (data61 < 0 || isNaN(data61)) {
                                                                                      validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/partialOrFailed/failedAttempts", schemaPath: "#/properties/periods/items/properties/partialOrFailed/properties/failedAttempts/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                      return false;
                                                                                    }
                                                                                  }
                                                                                }
                                                                              }
                                                                              var valid14 = _errs135 === errors2;
                                                                            } else {
                                                                              var valid14 = true;
                                                                            }
                                                                            if (valid14) {
                                                                              if (data58.cancelledAttempts !== void 0) {
                                                                                let data62 = data58.cancelledAttempts;
                                                                                const _errs137 = errors2;
                                                                                if (!(typeof data62 == "number" && (!(data62 % 1) && !isNaN(data62)) && isFinite(data62))) {
                                                                                  validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/partialOrFailed/cancelledAttempts", schemaPath: "#/properties/periods/items/properties/partialOrFailed/properties/cancelledAttempts/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                  return false;
                                                                                }
                                                                                if (errors2 === _errs137) {
                                                                                  if (typeof data62 == "number" && isFinite(data62)) {
                                                                                    if (data62 > 9007199254740991 || isNaN(data62)) {
                                                                                      validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/partialOrFailed/cancelledAttempts", schemaPath: "#/properties/periods/items/properties/partialOrFailed/properties/cancelledAttempts/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                      return false;
                                                                                    } else {
                                                                                      if (data62 < 0 || isNaN(data62)) {
                                                                                        validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/partialOrFailed/cancelledAttempts", schemaPath: "#/properties/periods/items/properties/partialOrFailed/properties/cancelledAttempts/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                        return false;
                                                                                      }
                                                                                    }
                                                                                  }
                                                                                }
                                                                                var valid14 = _errs137 === errors2;
                                                                              } else {
                                                                                var valid14 = true;
                                                                              }
                                                                              if (valid14) {
                                                                                if (data58.recordedAttempts !== void 0) {
                                                                                  let data63 = data58.recordedAttempts;
                                                                                  const _errs139 = errors2;
                                                                                  if (!(typeof data63 == "number" && (!(data63 % 1) && !isNaN(data63)) && isFinite(data63))) {
                                                                                    validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/partialOrFailed/recordedAttempts", schemaPath: "#/properties/periods/items/properties/partialOrFailed/properties/recordedAttempts/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                    return false;
                                                                                  }
                                                                                  if (errors2 === _errs139) {
                                                                                    if (typeof data63 == "number" && isFinite(data63)) {
                                                                                      if (data63 > 9007199254740991 || isNaN(data63)) {
                                                                                        validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/partialOrFailed/recordedAttempts", schemaPath: "#/properties/periods/items/properties/partialOrFailed/properties/recordedAttempts/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                        return false;
                                                                                      } else {
                                                                                        if (data63 < 0 || isNaN(data63)) {
                                                                                          validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/partialOrFailed/recordedAttempts", schemaPath: "#/properties/periods/items/properties/partialOrFailed/properties/recordedAttempts/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                          return false;
                                                                                        }
                                                                                      }
                                                                                    }
                                                                                  }
                                                                                  var valid14 = _errs139 === errors2;
                                                                                } else {
                                                                                  var valid14 = true;
                                                                                }
                                                                                if (valid14) {
                                                                                  if (data58.knownChargeMicroUsd !== void 0) {
                                                                                    let data64 = data58.knownChargeMicroUsd;
                                                                                    const _errs141 = errors2;
                                                                                    if (!(typeof data64 == "number" && (!(data64 % 1) && !isNaN(data64)) && isFinite(data64))) {
                                                                                      validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/partialOrFailed/knownChargeMicroUsd", schemaPath: "#/properties/periods/items/properties/partialOrFailed/properties/knownChargeMicroUsd/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                      return false;
                                                                                    }
                                                                                    if (errors2 === _errs141) {
                                                                                      if (typeof data64 == "number" && isFinite(data64)) {
                                                                                        if (data64 > 9007199254740991 || isNaN(data64)) {
                                                                                          validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/partialOrFailed/knownChargeMicroUsd", schemaPath: "#/properties/periods/items/properties/partialOrFailed/properties/knownChargeMicroUsd/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                          return false;
                                                                                        } else {
                                                                                          if (data64 < 0 || isNaN(data64)) {
                                                                                            validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/partialOrFailed/knownChargeMicroUsd", schemaPath: "#/properties/periods/items/properties/partialOrFailed/properties/knownChargeMicroUsd/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                            return false;
                                                                                          }
                                                                                        }
                                                                                      }
                                                                                    }
                                                                                    var valid14 = _errs141 === errors2;
                                                                                  } else {
                                                                                    var valid14 = true;
                                                                                  }
                                                                                  if (valid14) {
                                                                                    if (data58.microUsdPerRecordedAttempt !== void 0) {
                                                                                      let data65 = data58.microUsdPerRecordedAttempt;
                                                                                      const _errs143 = errors2;
                                                                                      const _errs144 = errors2;
                                                                                      let valid15 = false;
                                                                                      const _errs145 = errors2;
                                                                                      if (errors2 === _errs145) {
                                                                                        if (typeof data65 == "number" && isFinite(data65)) {
                                                                                          if (data65 > 9007199254740992e-6 || isNaN(data65)) {
                                                                                            const err40 = { instancePath: instancePath + "/periods/" + i0 + "/partialOrFailed/microUsdPerRecordedAttempt", schemaPath: "#/properties/periods/items/properties/partialOrFailed/properties/microUsdPerRecordedAttempt/anyOf/0/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740992e-6 }, message: "must be <= 9007199254.740992" };
                                                                                            if (vErrors === null) {
                                                                                              vErrors = [err40];
                                                                                            } else {
                                                                                              vErrors.push(err40);
                                                                                            }
                                                                                            errors2++;
                                                                                          } else {
                                                                                            if (data65 < 0 || isNaN(data65)) {
                                                                                              const err41 = { instancePath: instancePath + "/periods/" + i0 + "/partialOrFailed/microUsdPerRecordedAttempt", schemaPath: "#/properties/periods/items/properties/partialOrFailed/properties/microUsdPerRecordedAttempt/anyOf/0/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                                                                              if (vErrors === null) {
                                                                                                vErrors = [err41];
                                                                                              } else {
                                                                                                vErrors.push(err41);
                                                                                              }
                                                                                              errors2++;
                                                                                            }
                                                                                          }
                                                                                        } else {
                                                                                          const err42 = { instancePath: instancePath + "/periods/" + i0 + "/partialOrFailed/microUsdPerRecordedAttempt", schemaPath: "#/properties/periods/items/properties/partialOrFailed/properties/microUsdPerRecordedAttempt/anyOf/0/type", keyword: "type", params: { type: "number" }, message: "must be number" };
                                                                                          if (vErrors === null) {
                                                                                            vErrors = [err42];
                                                                                          } else {
                                                                                            vErrors.push(err42);
                                                                                          }
                                                                                          errors2++;
                                                                                        }
                                                                                      }
                                                                                      var _valid4 = _errs145 === errors2;
                                                                                      valid15 = valid15 || _valid4;
                                                                                      const _errs147 = errors2;
                                                                                      if (data65 !== null) {
                                                                                        const err43 = { instancePath: instancePath + "/periods/" + i0 + "/partialOrFailed/microUsdPerRecordedAttempt", schemaPath: "#/properties/periods/items/properties/partialOrFailed/properties/microUsdPerRecordedAttempt/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                                                                        if (vErrors === null) {
                                                                                          vErrors = [err43];
                                                                                        } else {
                                                                                          vErrors.push(err43);
                                                                                        }
                                                                                        errors2++;
                                                                                      }
                                                                                      var _valid4 = _errs147 === errors2;
                                                                                      valid15 = valid15 || _valid4;
                                                                                      if (!valid15) {
                                                                                        const err44 = { instancePath: instancePath + "/periods/" + i0 + "/partialOrFailed/microUsdPerRecordedAttempt", schemaPath: "#/properties/periods/items/properties/partialOrFailed/properties/microUsdPerRecordedAttempt/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                                                                        if (vErrors === null) {
                                                                                          vErrors = [err44];
                                                                                        } else {
                                                                                          vErrors.push(err44);
                                                                                        }
                                                                                        errors2++;
                                                                                        validate29.errors = vErrors;
                                                                                        return false;
                                                                                      } else {
                                                                                        errors2 = _errs144;
                                                                                        if (vErrors !== null) {
                                                                                          if (_errs144) {
                                                                                            vErrors.length = _errs144;
                                                                                          } else {
                                                                                            vErrors = null;
                                                                                          }
                                                                                        }
                                                                                      }
                                                                                      var valid14 = _errs143 === errors2;
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
                                                                    }
                                                                  } else {
                                                                    validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/partialOrFailed", schemaPath: "#/properties/periods/items/properties/partialOrFailed/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                                    return false;
                                                                  }
                                                                }
                                                                var valid5 = _errs130 === errors2;
                                                              } else {
                                                                var valid5 = true;
                                                              }
                                                              if (valid5) {
                                                                if (data17.liability !== void 0) {
                                                                  let data66 = data17.liability;
                                                                  const _errs149 = errors2;
                                                                  if (errors2 === _errs149) {
                                                                    if (data66 && typeof data66 == "object" && !Array.isArray(data66)) {
                                                                      let missing10;
                                                                      if (data66.chargeBasis === void 0 && (missing10 = "chargeBasis") || data66.recordedAttempts === void 0 && (missing10 = "recordedAttempts") || data66.knownChargeMicroUsd === void 0 && (missing10 = "knownChargeMicroUsd") || data66.microUsdPerRecordedAttempt === void 0 && (missing10 = "microUsdPerRecordedAttempt") || data66.unavailableAttempts === void 0 && (missing10 = "unavailableAttempts") || data66.notRecordedAttempts === void 0 && (missing10 = "notRecordedAttempts")) {
                                                                        validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/liability", schemaPath: "#/properties/periods/items/properties/liability/required", keyword: "required", params: { missingProperty: missing10 }, message: "must have required property '" + missing10 + "'" }];
                                                                        return false;
                                                                      } else {
                                                                        const _errs151 = errors2;
                                                                        for (const key10 in data66) {
                                                                          if (!(key10 === "chargeBasis" || key10 === "recordedAttempts" || key10 === "knownChargeMicroUsd" || key10 === "microUsdPerRecordedAttempt" || key10 === "unavailableAttempts" || key10 === "notRecordedAttempts")) {
                                                                            validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/liability", schemaPath: "#/properties/periods/items/properties/liability/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key10 }, message: "must NOT have additional properties" }];
                                                                            return false;
                                                                            break;
                                                                          }
                                                                        }
                                                                        if (_errs151 === errors2) {
                                                                          if (data66.chargeBasis !== void 0) {
                                                                            const _errs152 = errors2;
                                                                            if ("sdk-list-estimate" !== data66.chargeBasis) {
                                                                              validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/liability/chargeBasis", schemaPath: "#/properties/periods/items/properties/liability/properties/chargeBasis/const", keyword: "const", params: { allowedValue: "sdk-list-estimate" }, message: "must be equal to constant" }];
                                                                              return false;
                                                                            }
                                                                            var valid16 = _errs152 === errors2;
                                                                          } else {
                                                                            var valid16 = true;
                                                                          }
                                                                          if (valid16) {
                                                                            if (data66.recordedAttempts !== void 0) {
                                                                              let data68 = data66.recordedAttempts;
                                                                              const _errs153 = errors2;
                                                                              if (!(typeof data68 == "number" && (!(data68 % 1) && !isNaN(data68)) && isFinite(data68))) {
                                                                                validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/liability/recordedAttempts", schemaPath: "#/properties/periods/items/properties/liability/properties/recordedAttempts/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                return false;
                                                                              }
                                                                              if (errors2 === _errs153) {
                                                                                if (typeof data68 == "number" && isFinite(data68)) {
                                                                                  if (data68 > 9007199254740991 || isNaN(data68)) {
                                                                                    validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/liability/recordedAttempts", schemaPath: "#/properties/periods/items/properties/liability/properties/recordedAttempts/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                    return false;
                                                                                  } else {
                                                                                    if (data68 < 0 || isNaN(data68)) {
                                                                                      validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/liability/recordedAttempts", schemaPath: "#/properties/periods/items/properties/liability/properties/recordedAttempts/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                      return false;
                                                                                    }
                                                                                  }
                                                                                }
                                                                              }
                                                                              var valid16 = _errs153 === errors2;
                                                                            } else {
                                                                              var valid16 = true;
                                                                            }
                                                                            if (valid16) {
                                                                              if (data66.knownChargeMicroUsd !== void 0) {
                                                                                let data69 = data66.knownChargeMicroUsd;
                                                                                const _errs155 = errors2;
                                                                                if (!(typeof data69 == "number" && (!(data69 % 1) && !isNaN(data69)) && isFinite(data69))) {
                                                                                  validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/liability/knownChargeMicroUsd", schemaPath: "#/properties/periods/items/properties/liability/properties/knownChargeMicroUsd/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                  return false;
                                                                                }
                                                                                if (errors2 === _errs155) {
                                                                                  if (typeof data69 == "number" && isFinite(data69)) {
                                                                                    if (data69 > 9007199254740991 || isNaN(data69)) {
                                                                                      validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/liability/knownChargeMicroUsd", schemaPath: "#/properties/periods/items/properties/liability/properties/knownChargeMicroUsd/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                      return false;
                                                                                    } else {
                                                                                      if (data69 < 0 || isNaN(data69)) {
                                                                                        validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/liability/knownChargeMicroUsd", schemaPath: "#/properties/periods/items/properties/liability/properties/knownChargeMicroUsd/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                        return false;
                                                                                      }
                                                                                    }
                                                                                  }
                                                                                }
                                                                                var valid16 = _errs155 === errors2;
                                                                              } else {
                                                                                var valid16 = true;
                                                                              }
                                                                              if (valid16) {
                                                                                if (data66.microUsdPerRecordedAttempt !== void 0) {
                                                                                  let data70 = data66.microUsdPerRecordedAttempt;
                                                                                  const _errs157 = errors2;
                                                                                  const _errs158 = errors2;
                                                                                  let valid17 = false;
                                                                                  const _errs159 = errors2;
                                                                                  if (errors2 === _errs159) {
                                                                                    if (typeof data70 == "number" && isFinite(data70)) {
                                                                                      if (data70 > 9007199254740992e-6 || isNaN(data70)) {
                                                                                        const err45 = { instancePath: instancePath + "/periods/" + i0 + "/liability/microUsdPerRecordedAttempt", schemaPath: "#/properties/periods/items/properties/liability/properties/microUsdPerRecordedAttempt/anyOf/0/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740992e-6 }, message: "must be <= 9007199254.740992" };
                                                                                        if (vErrors === null) {
                                                                                          vErrors = [err45];
                                                                                        } else {
                                                                                          vErrors.push(err45);
                                                                                        }
                                                                                        errors2++;
                                                                                      } else {
                                                                                        if (data70 < 0 || isNaN(data70)) {
                                                                                          const err46 = { instancePath: instancePath + "/periods/" + i0 + "/liability/microUsdPerRecordedAttempt", schemaPath: "#/properties/periods/items/properties/liability/properties/microUsdPerRecordedAttempt/anyOf/0/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                                                                          if (vErrors === null) {
                                                                                            vErrors = [err46];
                                                                                          } else {
                                                                                            vErrors.push(err46);
                                                                                          }
                                                                                          errors2++;
                                                                                        }
                                                                                      }
                                                                                    } else {
                                                                                      const err47 = { instancePath: instancePath + "/periods/" + i0 + "/liability/microUsdPerRecordedAttempt", schemaPath: "#/properties/periods/items/properties/liability/properties/microUsdPerRecordedAttempt/anyOf/0/type", keyword: "type", params: { type: "number" }, message: "must be number" };
                                                                                      if (vErrors === null) {
                                                                                        vErrors = [err47];
                                                                                      } else {
                                                                                        vErrors.push(err47);
                                                                                      }
                                                                                      errors2++;
                                                                                    }
                                                                                  }
                                                                                  var _valid5 = _errs159 === errors2;
                                                                                  valid17 = valid17 || _valid5;
                                                                                  const _errs161 = errors2;
                                                                                  if (data70 !== null) {
                                                                                    const err48 = { instancePath: instancePath + "/periods/" + i0 + "/liability/microUsdPerRecordedAttempt", schemaPath: "#/properties/periods/items/properties/liability/properties/microUsdPerRecordedAttempt/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                                                                    if (vErrors === null) {
                                                                                      vErrors = [err48];
                                                                                    } else {
                                                                                      vErrors.push(err48);
                                                                                    }
                                                                                    errors2++;
                                                                                  }
                                                                                  var _valid5 = _errs161 === errors2;
                                                                                  valid17 = valid17 || _valid5;
                                                                                  if (!valid17) {
                                                                                    const err49 = { instancePath: instancePath + "/periods/" + i0 + "/liability/microUsdPerRecordedAttempt", schemaPath: "#/properties/periods/items/properties/liability/properties/microUsdPerRecordedAttempt/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                                                                    if (vErrors === null) {
                                                                                      vErrors = [err49];
                                                                                    } else {
                                                                                      vErrors.push(err49);
                                                                                    }
                                                                                    errors2++;
                                                                                    validate29.errors = vErrors;
                                                                                    return false;
                                                                                  } else {
                                                                                    errors2 = _errs158;
                                                                                    if (vErrors !== null) {
                                                                                      if (_errs158) {
                                                                                        vErrors.length = _errs158;
                                                                                      } else {
                                                                                        vErrors = null;
                                                                                      }
                                                                                    }
                                                                                  }
                                                                                  var valid16 = _errs157 === errors2;
                                                                                } else {
                                                                                  var valid16 = true;
                                                                                }
                                                                                if (valid16) {
                                                                                  if (data66.unavailableAttempts !== void 0) {
                                                                                    let data71 = data66.unavailableAttempts;
                                                                                    const _errs163 = errors2;
                                                                                    if (!(typeof data71 == "number" && (!(data71 % 1) && !isNaN(data71)) && isFinite(data71))) {
                                                                                      validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/liability/unavailableAttempts", schemaPath: "#/properties/periods/items/properties/liability/properties/unavailableAttempts/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                      return false;
                                                                                    }
                                                                                    if (errors2 === _errs163) {
                                                                                      if (typeof data71 == "number" && isFinite(data71)) {
                                                                                        if (data71 > 9007199254740991 || isNaN(data71)) {
                                                                                          validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/liability/unavailableAttempts", schemaPath: "#/properties/periods/items/properties/liability/properties/unavailableAttempts/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                          return false;
                                                                                        } else {
                                                                                          if (data71 < 0 || isNaN(data71)) {
                                                                                            validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/liability/unavailableAttempts", schemaPath: "#/properties/periods/items/properties/liability/properties/unavailableAttempts/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                            return false;
                                                                                          }
                                                                                        }
                                                                                      }
                                                                                    }
                                                                                    var valid16 = _errs163 === errors2;
                                                                                  } else {
                                                                                    var valid16 = true;
                                                                                  }
                                                                                  if (valid16) {
                                                                                    if (data66.notRecordedAttempts !== void 0) {
                                                                                      let data72 = data66.notRecordedAttempts;
                                                                                      const _errs165 = errors2;
                                                                                      if (!(typeof data72 == "number" && (!(data72 % 1) && !isNaN(data72)) && isFinite(data72))) {
                                                                                        validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/liability/notRecordedAttempts", schemaPath: "#/properties/periods/items/properties/liability/properties/notRecordedAttempts/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                        return false;
                                                                                      }
                                                                                      if (errors2 === _errs165) {
                                                                                        if (typeof data72 == "number" && isFinite(data72)) {
                                                                                          if (data72 > 9007199254740991 || isNaN(data72)) {
                                                                                            validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/liability/notRecordedAttempts", schemaPath: "#/properties/periods/items/properties/liability/properties/notRecordedAttempts/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                            return false;
                                                                                          } else {
                                                                                            if (data72 < 0 || isNaN(data72)) {
                                                                                              validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/liability/notRecordedAttempts", schemaPath: "#/properties/periods/items/properties/liability/properties/notRecordedAttempts/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                              return false;
                                                                                            }
                                                                                          }
                                                                                        }
                                                                                      }
                                                                                      var valid16 = _errs165 === errors2;
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
                                                                    } else {
                                                                      validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/liability", schemaPath: "#/properties/periods/items/properties/liability/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                                      return false;
                                                                    }
                                                                  }
                                                                  var valid5 = _errs149 === errors2;
                                                                } else {
                                                                  var valid5 = true;
                                                                }
                                                                if (valid5) {
                                                                  if (data17.lineage !== void 0) {
                                                                    let data73 = data17.lineage;
                                                                    const _errs167 = errors2;
                                                                    if (errors2 === _errs167) {
                                                                      if (data73 && typeof data73 == "object" && !Array.isArray(data73)) {
                                                                        let missing11;
                                                                        if (data73.basis === void 0 && (missing11 = "basis") || data73.root === void 0 && (missing11 = "root") || data73.fork === void 0 && (missing11 = "fork") || data73.resume === void 0 && (missing11 = "resume") || data73["unknown-lineage"] === void 0 && (missing11 = "unknown-lineage")) {
                                                                          validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage", schemaPath: "#/properties/periods/items/properties/lineage/required", keyword: "required", params: { missingProperty: missing11 }, message: "must have required property '" + missing11 + "'" }];
                                                                          return false;
                                                                        } else {
                                                                          const _errs169 = errors2;
                                                                          for (const key11 in data73) {
                                                                            if (!(key11 === "basis" || key11 === "root" || key11 === "fork" || key11 === "resume" || key11 === "unknown-lineage")) {
                                                                              validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage", schemaPath: "#/properties/periods/items/properties/lineage/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key11 }, message: "must NOT have additional properties" }];
                                                                              return false;
                                                                              break;
                                                                            }
                                                                          }
                                                                          if (_errs169 === errors2) {
                                                                            if (data73.basis !== void 0) {
                                                                              const _errs170 = errors2;
                                                                              if ("sdk_usage.parentRunId plus the run binding writerFence: absent parent = root thread start; writerFence 1 = fork into a separate logical thread; writerFence 2 or more = resume continuation of the same thread" !== data73.basis) {
                                                                                validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage/basis", schemaPath: "#/properties/periods/items/properties/lineage/properties/basis/const", keyword: "const", params: { allowedValue: "sdk_usage.parentRunId plus the run binding writerFence: absent parent = root thread start; writerFence 1 = fork into a separate logical thread; writerFence 2 or more = resume continuation of the same thread" }, message: "must be equal to constant" }];
                                                                                return false;
                                                                              }
                                                                              var valid18 = _errs170 === errors2;
                                                                            } else {
                                                                              var valid18 = true;
                                                                            }
                                                                            if (valid18) {
                                                                              if (data73.root !== void 0) {
                                                                                let data75 = data73.root;
                                                                                const _errs171 = errors2;
                                                                                if (errors2 === _errs171) {
                                                                                  if (data75 && typeof data75 == "object" && !Array.isArray(data75)) {
                                                                                    let missing12;
                                                                                    if (data75.attempts === void 0 && (missing12 = "attempts") || data75.chargeMicroUsd === void 0 && (missing12 = "chargeMicroUsd")) {
                                                                                      validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage/root", schemaPath: "#/properties/periods/items/properties/lineage/properties/root/required", keyword: "required", params: { missingProperty: missing12 }, message: "must have required property '" + missing12 + "'" }];
                                                                                      return false;
                                                                                    } else {
                                                                                      const _errs173 = errors2;
                                                                                      for (const key12 in data75) {
                                                                                        if (!(key12 === "attempts" || key12 === "chargeMicroUsd")) {
                                                                                          validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage/root", schemaPath: "#/properties/periods/items/properties/lineage/properties/root/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key12 }, message: "must NOT have additional properties" }];
                                                                                          return false;
                                                                                          break;
                                                                                        }
                                                                                      }
                                                                                      if (_errs173 === errors2) {
                                                                                        if (data75.attempts !== void 0) {
                                                                                          let data76 = data75.attempts;
                                                                                          const _errs174 = errors2;
                                                                                          if (!(typeof data76 == "number" && (!(data76 % 1) && !isNaN(data76)) && isFinite(data76))) {
                                                                                            validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage/root/attempts", schemaPath: "#/properties/periods/items/properties/lineage/properties/root/properties/attempts/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                            return false;
                                                                                          }
                                                                                          if (errors2 === _errs174) {
                                                                                            if (typeof data76 == "number" && isFinite(data76)) {
                                                                                              if (data76 > 9007199254740991 || isNaN(data76)) {
                                                                                                validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage/root/attempts", schemaPath: "#/properties/periods/items/properties/lineage/properties/root/properties/attempts/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                                return false;
                                                                                              } else {
                                                                                                if (data76 < 0 || isNaN(data76)) {
                                                                                                  validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage/root/attempts", schemaPath: "#/properties/periods/items/properties/lineage/properties/root/properties/attempts/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                                  return false;
                                                                                                }
                                                                                              }
                                                                                            }
                                                                                          }
                                                                                          var valid19 = _errs174 === errors2;
                                                                                        } else {
                                                                                          var valid19 = true;
                                                                                        }
                                                                                        if (valid19) {
                                                                                          if (data75.chargeMicroUsd !== void 0) {
                                                                                            let data77 = data75.chargeMicroUsd;
                                                                                            const _errs176 = errors2;
                                                                                            if (!(typeof data77 == "number" && (!(data77 % 1) && !isNaN(data77)) && isFinite(data77))) {
                                                                                              validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage/root/chargeMicroUsd", schemaPath: "#/properties/periods/items/properties/lineage/properties/root/properties/chargeMicroUsd/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                              return false;
                                                                                            }
                                                                                            if (errors2 === _errs176) {
                                                                                              if (typeof data77 == "number" && isFinite(data77)) {
                                                                                                if (data77 > 9007199254740991 || isNaN(data77)) {
                                                                                                  validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage/root/chargeMicroUsd", schemaPath: "#/properties/periods/items/properties/lineage/properties/root/properties/chargeMicroUsd/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                                  return false;
                                                                                                } else {
                                                                                                  if (data77 < 0 || isNaN(data77)) {
                                                                                                    validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage/root/chargeMicroUsd", schemaPath: "#/properties/periods/items/properties/lineage/properties/root/properties/chargeMicroUsd/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                                    return false;
                                                                                                  }
                                                                                                }
                                                                                              }
                                                                                            }
                                                                                            var valid19 = _errs176 === errors2;
                                                                                          } else {
                                                                                            var valid19 = true;
                                                                                          }
                                                                                        }
                                                                                      }
                                                                                    }
                                                                                  } else {
                                                                                    validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage/root", schemaPath: "#/properties/periods/items/properties/lineage/properties/root/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                                                    return false;
                                                                                  }
                                                                                }
                                                                                var valid18 = _errs171 === errors2;
                                                                              } else {
                                                                                var valid18 = true;
                                                                              }
                                                                              if (valid18) {
                                                                                if (data73.fork !== void 0) {
                                                                                  let data78 = data73.fork;
                                                                                  const _errs178 = errors2;
                                                                                  if (errors2 === _errs178) {
                                                                                    if (data78 && typeof data78 == "object" && !Array.isArray(data78)) {
                                                                                      let missing13;
                                                                                      if (data78.attempts === void 0 && (missing13 = "attempts") || data78.chargeMicroUsd === void 0 && (missing13 = "chargeMicroUsd")) {
                                                                                        validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage/fork", schemaPath: "#/properties/periods/items/properties/lineage/properties/fork/required", keyword: "required", params: { missingProperty: missing13 }, message: "must have required property '" + missing13 + "'" }];
                                                                                        return false;
                                                                                      } else {
                                                                                        const _errs180 = errors2;
                                                                                        for (const key13 in data78) {
                                                                                          if (!(key13 === "attempts" || key13 === "chargeMicroUsd")) {
                                                                                            validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage/fork", schemaPath: "#/properties/periods/items/properties/lineage/properties/fork/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key13 }, message: "must NOT have additional properties" }];
                                                                                            return false;
                                                                                            break;
                                                                                          }
                                                                                        }
                                                                                        if (_errs180 === errors2) {
                                                                                          if (data78.attempts !== void 0) {
                                                                                            let data79 = data78.attempts;
                                                                                            const _errs181 = errors2;
                                                                                            if (!(typeof data79 == "number" && (!(data79 % 1) && !isNaN(data79)) && isFinite(data79))) {
                                                                                              validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage/fork/attempts", schemaPath: "#/properties/periods/items/properties/lineage/properties/fork/properties/attempts/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                              return false;
                                                                                            }
                                                                                            if (errors2 === _errs181) {
                                                                                              if (typeof data79 == "number" && isFinite(data79)) {
                                                                                                if (data79 > 9007199254740991 || isNaN(data79)) {
                                                                                                  validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage/fork/attempts", schemaPath: "#/properties/periods/items/properties/lineage/properties/fork/properties/attempts/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                                  return false;
                                                                                                } else {
                                                                                                  if (data79 < 0 || isNaN(data79)) {
                                                                                                    validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage/fork/attempts", schemaPath: "#/properties/periods/items/properties/lineage/properties/fork/properties/attempts/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                                    return false;
                                                                                                  }
                                                                                                }
                                                                                              }
                                                                                            }
                                                                                            var valid20 = _errs181 === errors2;
                                                                                          } else {
                                                                                            var valid20 = true;
                                                                                          }
                                                                                          if (valid20) {
                                                                                            if (data78.chargeMicroUsd !== void 0) {
                                                                                              let data80 = data78.chargeMicroUsd;
                                                                                              const _errs183 = errors2;
                                                                                              if (!(typeof data80 == "number" && (!(data80 % 1) && !isNaN(data80)) && isFinite(data80))) {
                                                                                                validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage/fork/chargeMicroUsd", schemaPath: "#/properties/periods/items/properties/lineage/properties/fork/properties/chargeMicroUsd/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                                return false;
                                                                                              }
                                                                                              if (errors2 === _errs183) {
                                                                                                if (typeof data80 == "number" && isFinite(data80)) {
                                                                                                  if (data80 > 9007199254740991 || isNaN(data80)) {
                                                                                                    validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage/fork/chargeMicroUsd", schemaPath: "#/properties/periods/items/properties/lineage/properties/fork/properties/chargeMicroUsd/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                                    return false;
                                                                                                  } else {
                                                                                                    if (data80 < 0 || isNaN(data80)) {
                                                                                                      validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage/fork/chargeMicroUsd", schemaPath: "#/properties/periods/items/properties/lineage/properties/fork/properties/chargeMicroUsd/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                                      return false;
                                                                                                    }
                                                                                                  }
                                                                                                }
                                                                                              }
                                                                                              var valid20 = _errs183 === errors2;
                                                                                            } else {
                                                                                              var valid20 = true;
                                                                                            }
                                                                                          }
                                                                                        }
                                                                                      }
                                                                                    } else {
                                                                                      validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage/fork", schemaPath: "#/properties/periods/items/properties/lineage/properties/fork/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                                                      return false;
                                                                                    }
                                                                                  }
                                                                                  var valid18 = _errs178 === errors2;
                                                                                } else {
                                                                                  var valid18 = true;
                                                                                }
                                                                                if (valid18) {
                                                                                  if (data73.resume !== void 0) {
                                                                                    let data81 = data73.resume;
                                                                                    const _errs185 = errors2;
                                                                                    if (errors2 === _errs185) {
                                                                                      if (data81 && typeof data81 == "object" && !Array.isArray(data81)) {
                                                                                        let missing14;
                                                                                        if (data81.attempts === void 0 && (missing14 = "attempts") || data81.chargeMicroUsd === void 0 && (missing14 = "chargeMicroUsd")) {
                                                                                          validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage/resume", schemaPath: "#/properties/periods/items/properties/lineage/properties/resume/required", keyword: "required", params: { missingProperty: missing14 }, message: "must have required property '" + missing14 + "'" }];
                                                                                          return false;
                                                                                        } else {
                                                                                          const _errs187 = errors2;
                                                                                          for (const key14 in data81) {
                                                                                            if (!(key14 === "attempts" || key14 === "chargeMicroUsd")) {
                                                                                              validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage/resume", schemaPath: "#/properties/periods/items/properties/lineage/properties/resume/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key14 }, message: "must NOT have additional properties" }];
                                                                                              return false;
                                                                                              break;
                                                                                            }
                                                                                          }
                                                                                          if (_errs187 === errors2) {
                                                                                            if (data81.attempts !== void 0) {
                                                                                              let data82 = data81.attempts;
                                                                                              const _errs188 = errors2;
                                                                                              if (!(typeof data82 == "number" && (!(data82 % 1) && !isNaN(data82)) && isFinite(data82))) {
                                                                                                validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage/resume/attempts", schemaPath: "#/properties/periods/items/properties/lineage/properties/resume/properties/attempts/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                                return false;
                                                                                              }
                                                                                              if (errors2 === _errs188) {
                                                                                                if (typeof data82 == "number" && isFinite(data82)) {
                                                                                                  if (data82 > 9007199254740991 || isNaN(data82)) {
                                                                                                    validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage/resume/attempts", schemaPath: "#/properties/periods/items/properties/lineage/properties/resume/properties/attempts/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                                    return false;
                                                                                                  } else {
                                                                                                    if (data82 < 0 || isNaN(data82)) {
                                                                                                      validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage/resume/attempts", schemaPath: "#/properties/periods/items/properties/lineage/properties/resume/properties/attempts/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                                      return false;
                                                                                                    }
                                                                                                  }
                                                                                                }
                                                                                              }
                                                                                              var valid21 = _errs188 === errors2;
                                                                                            } else {
                                                                                              var valid21 = true;
                                                                                            }
                                                                                            if (valid21) {
                                                                                              if (data81.chargeMicroUsd !== void 0) {
                                                                                                let data83 = data81.chargeMicroUsd;
                                                                                                const _errs190 = errors2;
                                                                                                if (!(typeof data83 == "number" && (!(data83 % 1) && !isNaN(data83)) && isFinite(data83))) {
                                                                                                  validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage/resume/chargeMicroUsd", schemaPath: "#/properties/periods/items/properties/lineage/properties/resume/properties/chargeMicroUsd/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                                  return false;
                                                                                                }
                                                                                                if (errors2 === _errs190) {
                                                                                                  if (typeof data83 == "number" && isFinite(data83)) {
                                                                                                    if (data83 > 9007199254740991 || isNaN(data83)) {
                                                                                                      validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage/resume/chargeMicroUsd", schemaPath: "#/properties/periods/items/properties/lineage/properties/resume/properties/chargeMicroUsd/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                                      return false;
                                                                                                    } else {
                                                                                                      if (data83 < 0 || isNaN(data83)) {
                                                                                                        validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage/resume/chargeMicroUsd", schemaPath: "#/properties/periods/items/properties/lineage/properties/resume/properties/chargeMicroUsd/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                                        return false;
                                                                                                      }
                                                                                                    }
                                                                                                  }
                                                                                                }
                                                                                                var valid21 = _errs190 === errors2;
                                                                                              } else {
                                                                                                var valid21 = true;
                                                                                              }
                                                                                            }
                                                                                          }
                                                                                        }
                                                                                      } else {
                                                                                        validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage/resume", schemaPath: "#/properties/periods/items/properties/lineage/properties/resume/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                                                        return false;
                                                                                      }
                                                                                    }
                                                                                    var valid18 = _errs185 === errors2;
                                                                                  } else {
                                                                                    var valid18 = true;
                                                                                  }
                                                                                  if (valid18) {
                                                                                    if (data73["unknown-lineage"] !== void 0) {
                                                                                      let data84 = data73["unknown-lineage"];
                                                                                      const _errs192 = errors2;
                                                                                      if (errors2 === _errs192) {
                                                                                        if (data84 && typeof data84 == "object" && !Array.isArray(data84)) {
                                                                                          let missing15;
                                                                                          if (data84.attempts === void 0 && (missing15 = "attempts") || data84.chargeMicroUsd === void 0 && (missing15 = "chargeMicroUsd")) {
                                                                                            validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage/unknown-lineage", schemaPath: "#/properties/periods/items/properties/lineage/properties/unknown-lineage/required", keyword: "required", params: { missingProperty: missing15 }, message: "must have required property '" + missing15 + "'" }];
                                                                                            return false;
                                                                                          } else {
                                                                                            const _errs194 = errors2;
                                                                                            for (const key15 in data84) {
                                                                                              if (!(key15 === "attempts" || key15 === "chargeMicroUsd")) {
                                                                                                validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage/unknown-lineage", schemaPath: "#/properties/periods/items/properties/lineage/properties/unknown-lineage/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key15 }, message: "must NOT have additional properties" }];
                                                                                                return false;
                                                                                                break;
                                                                                              }
                                                                                            }
                                                                                            if (_errs194 === errors2) {
                                                                                              if (data84.attempts !== void 0) {
                                                                                                let data85 = data84.attempts;
                                                                                                const _errs195 = errors2;
                                                                                                if (!(typeof data85 == "number" && (!(data85 % 1) && !isNaN(data85)) && isFinite(data85))) {
                                                                                                  validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage/unknown-lineage/attempts", schemaPath: "#/properties/periods/items/properties/lineage/properties/unknown-lineage/properties/attempts/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                                  return false;
                                                                                                }
                                                                                                if (errors2 === _errs195) {
                                                                                                  if (typeof data85 == "number" && isFinite(data85)) {
                                                                                                    if (data85 > 9007199254740991 || isNaN(data85)) {
                                                                                                      validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage/unknown-lineage/attempts", schemaPath: "#/properties/periods/items/properties/lineage/properties/unknown-lineage/properties/attempts/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                                      return false;
                                                                                                    } else {
                                                                                                      if (data85 < 0 || isNaN(data85)) {
                                                                                                        validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage/unknown-lineage/attempts", schemaPath: "#/properties/periods/items/properties/lineage/properties/unknown-lineage/properties/attempts/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                                        return false;
                                                                                                      }
                                                                                                    }
                                                                                                  }
                                                                                                }
                                                                                                var valid22 = _errs195 === errors2;
                                                                                              } else {
                                                                                                var valid22 = true;
                                                                                              }
                                                                                              if (valid22) {
                                                                                                if (data84.chargeMicroUsd !== void 0) {
                                                                                                  let data86 = data84.chargeMicroUsd;
                                                                                                  const _errs197 = errors2;
                                                                                                  if (!(typeof data86 == "number" && (!(data86 % 1) && !isNaN(data86)) && isFinite(data86))) {
                                                                                                    validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage/unknown-lineage/chargeMicroUsd", schemaPath: "#/properties/periods/items/properties/lineage/properties/unknown-lineage/properties/chargeMicroUsd/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                                    return false;
                                                                                                  }
                                                                                                  if (errors2 === _errs197) {
                                                                                                    if (typeof data86 == "number" && isFinite(data86)) {
                                                                                                      if (data86 > 9007199254740991 || isNaN(data86)) {
                                                                                                        validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage/unknown-lineage/chargeMicroUsd", schemaPath: "#/properties/periods/items/properties/lineage/properties/unknown-lineage/properties/chargeMicroUsd/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                                        return false;
                                                                                                      } else {
                                                                                                        if (data86 < 0 || isNaN(data86)) {
                                                                                                          validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage/unknown-lineage/chargeMicroUsd", schemaPath: "#/properties/periods/items/properties/lineage/properties/unknown-lineage/properties/chargeMicroUsd/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                                          return false;
                                                                                                        }
                                                                                                      }
                                                                                                    }
                                                                                                  }
                                                                                                  var valid22 = _errs197 === errors2;
                                                                                                } else {
                                                                                                  var valid22 = true;
                                                                                                }
                                                                                              }
                                                                                            }
                                                                                          }
                                                                                        } else {
                                                                                          validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage/unknown-lineage", schemaPath: "#/properties/periods/items/properties/lineage/properties/unknown-lineage/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                                                          return false;
                                                                                        }
                                                                                      }
                                                                                      var valid18 = _errs192 === errors2;
                                                                                    } else {
                                                                                      var valid18 = true;
                                                                                    }
                                                                                  }
                                                                                }
                                                                              }
                                                                            }
                                                                          }
                                                                        }
                                                                      } else {
                                                                        validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/lineage", schemaPath: "#/properties/periods/items/properties/lineage/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                                        return false;
                                                                      }
                                                                    }
                                                                    var valid5 = _errs167 === errors2;
                                                                  } else {
                                                                    var valid5 = true;
                                                                  }
                                                                  if (valid5) {
                                                                    if (data17.counters !== void 0) {
                                                                      let data87 = data17.counters;
                                                                      const _errs199 = errors2;
                                                                      if (errors2 === _errs199) {
                                                                        if (data87 && typeof data87 == "object" && !Array.isArray(data87)) {
                                                                          let missing16;
                                                                          if (data87.inputTokens === void 0 && (missing16 = "inputTokens") || data87.outputTokens === void 0 && (missing16 = "outputTokens") || data87.cacheReadInputTokens === void 0 && (missing16 = "cacheReadInputTokens") || data87.cacheCreationInputTokens === void 0 && (missing16 = "cacheCreationInputTokens") || data87.webSearchRequests === void 0 && (missing16 = "webSearchRequests") || data87.toolInvocations === void 0 && (missing16 = "toolInvocations") || data87.toolFailures === void 0 && (missing16 = "toolFailures")) {
                                                                            validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/counters", schemaPath: "#/properties/periods/items/properties/counters/required", keyword: "required", params: { missingProperty: missing16 }, message: "must have required property '" + missing16 + "'" }];
                                                                            return false;
                                                                          } else {
                                                                            const _errs201 = errors2;
                                                                            for (const key16 in data87) {
                                                                              if (!(key16 === "inputTokens" || key16 === "outputTokens" || key16 === "cacheReadInputTokens" || key16 === "cacheCreationInputTokens" || key16 === "webSearchRequests" || key16 === "toolInvocations" || key16 === "toolFailures")) {
                                                                                validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/counters", schemaPath: "#/properties/periods/items/properties/counters/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key16 }, message: "must NOT have additional properties" }];
                                                                                return false;
                                                                                break;
                                                                              }
                                                                            }
                                                                            if (_errs201 === errors2) {
                                                                              if (data87.inputTokens !== void 0) {
                                                                                let data88 = data87.inputTokens;
                                                                                const _errs202 = errors2;
                                                                                if (!(typeof data88 == "number" && (!(data88 % 1) && !isNaN(data88)) && isFinite(data88))) {
                                                                                  validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/counters/inputTokens", schemaPath: "#/properties/periods/items/properties/counters/properties/inputTokens/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                  return false;
                                                                                }
                                                                                if (errors2 === _errs202) {
                                                                                  if (typeof data88 == "number" && isFinite(data88)) {
                                                                                    if (data88 > 9007199254740991 || isNaN(data88)) {
                                                                                      validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/counters/inputTokens", schemaPath: "#/properties/periods/items/properties/counters/properties/inputTokens/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                      return false;
                                                                                    } else {
                                                                                      if (data88 < 0 || isNaN(data88)) {
                                                                                        validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/counters/inputTokens", schemaPath: "#/properties/periods/items/properties/counters/properties/inputTokens/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                        return false;
                                                                                      }
                                                                                    }
                                                                                  }
                                                                                }
                                                                                var valid23 = _errs202 === errors2;
                                                                              } else {
                                                                                var valid23 = true;
                                                                              }
                                                                              if (valid23) {
                                                                                if (data87.outputTokens !== void 0) {
                                                                                  let data89 = data87.outputTokens;
                                                                                  const _errs204 = errors2;
                                                                                  if (!(typeof data89 == "number" && (!(data89 % 1) && !isNaN(data89)) && isFinite(data89))) {
                                                                                    validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/counters/outputTokens", schemaPath: "#/properties/periods/items/properties/counters/properties/outputTokens/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                    return false;
                                                                                  }
                                                                                  if (errors2 === _errs204) {
                                                                                    if (typeof data89 == "number" && isFinite(data89)) {
                                                                                      if (data89 > 9007199254740991 || isNaN(data89)) {
                                                                                        validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/counters/outputTokens", schemaPath: "#/properties/periods/items/properties/counters/properties/outputTokens/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                        return false;
                                                                                      } else {
                                                                                        if (data89 < 0 || isNaN(data89)) {
                                                                                          validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/counters/outputTokens", schemaPath: "#/properties/periods/items/properties/counters/properties/outputTokens/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                          return false;
                                                                                        }
                                                                                      }
                                                                                    }
                                                                                  }
                                                                                  var valid23 = _errs204 === errors2;
                                                                                } else {
                                                                                  var valid23 = true;
                                                                                }
                                                                                if (valid23) {
                                                                                  if (data87.cacheReadInputTokens !== void 0) {
                                                                                    let data90 = data87.cacheReadInputTokens;
                                                                                    const _errs206 = errors2;
                                                                                    if (!(typeof data90 == "number" && (!(data90 % 1) && !isNaN(data90)) && isFinite(data90))) {
                                                                                      validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/counters/cacheReadInputTokens", schemaPath: "#/properties/periods/items/properties/counters/properties/cacheReadInputTokens/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                      return false;
                                                                                    }
                                                                                    if (errors2 === _errs206) {
                                                                                      if (typeof data90 == "number" && isFinite(data90)) {
                                                                                        if (data90 > 9007199254740991 || isNaN(data90)) {
                                                                                          validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/counters/cacheReadInputTokens", schemaPath: "#/properties/periods/items/properties/counters/properties/cacheReadInputTokens/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                          return false;
                                                                                        } else {
                                                                                          if (data90 < 0 || isNaN(data90)) {
                                                                                            validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/counters/cacheReadInputTokens", schemaPath: "#/properties/periods/items/properties/counters/properties/cacheReadInputTokens/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                            return false;
                                                                                          }
                                                                                        }
                                                                                      }
                                                                                    }
                                                                                    var valid23 = _errs206 === errors2;
                                                                                  } else {
                                                                                    var valid23 = true;
                                                                                  }
                                                                                  if (valid23) {
                                                                                    if (data87.cacheCreationInputTokens !== void 0) {
                                                                                      let data91 = data87.cacheCreationInputTokens;
                                                                                      const _errs208 = errors2;
                                                                                      if (!(typeof data91 == "number" && (!(data91 % 1) && !isNaN(data91)) && isFinite(data91))) {
                                                                                        validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/counters/cacheCreationInputTokens", schemaPath: "#/properties/periods/items/properties/counters/properties/cacheCreationInputTokens/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                        return false;
                                                                                      }
                                                                                      if (errors2 === _errs208) {
                                                                                        if (typeof data91 == "number" && isFinite(data91)) {
                                                                                          if (data91 > 9007199254740991 || isNaN(data91)) {
                                                                                            validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/counters/cacheCreationInputTokens", schemaPath: "#/properties/periods/items/properties/counters/properties/cacheCreationInputTokens/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                            return false;
                                                                                          } else {
                                                                                            if (data91 < 0 || isNaN(data91)) {
                                                                                              validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/counters/cacheCreationInputTokens", schemaPath: "#/properties/periods/items/properties/counters/properties/cacheCreationInputTokens/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                              return false;
                                                                                            }
                                                                                          }
                                                                                        }
                                                                                      }
                                                                                      var valid23 = _errs208 === errors2;
                                                                                    } else {
                                                                                      var valid23 = true;
                                                                                    }
                                                                                    if (valid23) {
                                                                                      if (data87.webSearchRequests !== void 0) {
                                                                                        let data92 = data87.webSearchRequests;
                                                                                        const _errs210 = errors2;
                                                                                        if (!(typeof data92 == "number" && (!(data92 % 1) && !isNaN(data92)) && isFinite(data92))) {
                                                                                          validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/counters/webSearchRequests", schemaPath: "#/properties/periods/items/properties/counters/properties/webSearchRequests/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                          return false;
                                                                                        }
                                                                                        if (errors2 === _errs210) {
                                                                                          if (typeof data92 == "number" && isFinite(data92)) {
                                                                                            if (data92 > 9007199254740991 || isNaN(data92)) {
                                                                                              validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/counters/webSearchRequests", schemaPath: "#/properties/periods/items/properties/counters/properties/webSearchRequests/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                              return false;
                                                                                            } else {
                                                                                              if (data92 < 0 || isNaN(data92)) {
                                                                                                validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/counters/webSearchRequests", schemaPath: "#/properties/periods/items/properties/counters/properties/webSearchRequests/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                                return false;
                                                                                              }
                                                                                            }
                                                                                          }
                                                                                        }
                                                                                        var valid23 = _errs210 === errors2;
                                                                                      } else {
                                                                                        var valid23 = true;
                                                                                      }
                                                                                      if (valid23) {
                                                                                        if (data87.toolInvocations !== void 0) {
                                                                                          let data93 = data87.toolInvocations;
                                                                                          const _errs212 = errors2;
                                                                                          if (!(typeof data93 == "number" && (!(data93 % 1) && !isNaN(data93)) && isFinite(data93))) {
                                                                                            validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/counters/toolInvocations", schemaPath: "#/properties/periods/items/properties/counters/properties/toolInvocations/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                            return false;
                                                                                          }
                                                                                          if (errors2 === _errs212) {
                                                                                            if (typeof data93 == "number" && isFinite(data93)) {
                                                                                              if (data93 > 9007199254740991 || isNaN(data93)) {
                                                                                                validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/counters/toolInvocations", schemaPath: "#/properties/periods/items/properties/counters/properties/toolInvocations/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                                return false;
                                                                                              } else {
                                                                                                if (data93 < 0 || isNaN(data93)) {
                                                                                                  validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/counters/toolInvocations", schemaPath: "#/properties/periods/items/properties/counters/properties/toolInvocations/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                                  return false;
                                                                                                }
                                                                                              }
                                                                                            }
                                                                                          }
                                                                                          var valid23 = _errs212 === errors2;
                                                                                        } else {
                                                                                          var valid23 = true;
                                                                                        }
                                                                                        if (valid23) {
                                                                                          if (data87.toolFailures !== void 0) {
                                                                                            let data94 = data87.toolFailures;
                                                                                            const _errs214 = errors2;
                                                                                            if (!(typeof data94 == "number" && (!(data94 % 1) && !isNaN(data94)) && isFinite(data94))) {
                                                                                              validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/counters/toolFailures", schemaPath: "#/properties/periods/items/properties/counters/properties/toolFailures/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                              return false;
                                                                                            }
                                                                                            if (errors2 === _errs214) {
                                                                                              if (typeof data94 == "number" && isFinite(data94)) {
                                                                                                if (data94 > 9007199254740991 || isNaN(data94)) {
                                                                                                  validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/counters/toolFailures", schemaPath: "#/properties/periods/items/properties/counters/properties/toolFailures/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                                  return false;
                                                                                                } else {
                                                                                                  if (data94 < 0 || isNaN(data94)) {
                                                                                                    validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/counters/toolFailures", schemaPath: "#/properties/periods/items/properties/counters/properties/toolFailures/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                                    return false;
                                                                                                  }
                                                                                                }
                                                                                              }
                                                                                            }
                                                                                            var valid23 = _errs214 === errors2;
                                                                                          } else {
                                                                                            var valid23 = true;
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
                                                                          validate29.errors = [{ instancePath: instancePath + "/periods/" + i0 + "/counters", schemaPath: "#/properties/periods/items/properties/counters/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                                          return false;
                                                                        }
                                                                      }
                                                                      var valid5 = _errs199 === errors2;
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
                                              }
                                            }
                                          }
                                        }
                                      }
                                    } else {
                                      validate29.errors = [{ instancePath: instancePath + "/periods/" + i0, schemaPath: "#/properties/periods/items/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                      return false;
                                    }
                                  }
                                  var valid4 = _errs36 === errors2;
                                  if (!valid4) {
                                    break;
                                  }
                                }
                              }
                            }
                          } else {
                            validate29.errors = [{ instancePath: instancePath + "/periods", schemaPath: "#/properties/periods/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                            return false;
                          }
                        }
                        var valid0 = _errs34 === errors2;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.monthlyAdmission !== void 0) {
                          let data95 = data.monthlyAdmission;
                          const _errs216 = errors2;
                          if (errors2 === _errs216) {
                            if (data95 && typeof data95 == "object" && !Array.isArray(data95)) {
                              let missing17;
                              if (data95.startInclusive === void 0 && (missing17 = "startInclusive") || data95.knownChargeMicroUsd === void 0 && (missing17 = "knownChargeMicroUsd") || data95.unavailableRecordedAttempts === void 0 && (missing17 = "unavailableRecordedAttempts") || data95.remainingKnownMicroUsd === void 0 && (missing17 = "remainingKnownMicroUsd") || data95.reached === void 0 && (missing17 = "reached")) {
                                validate29.errors = [{ instancePath: instancePath + "/monthlyAdmission", schemaPath: "#/properties/monthlyAdmission/required", keyword: "required", params: { missingProperty: missing17 }, message: "must have required property '" + missing17 + "'" }];
                                return false;
                              } else {
                                const _errs218 = errors2;
                                for (const key17 in data95) {
                                  if (!(key17 === "startInclusive" || key17 === "knownChargeMicroUsd" || key17 === "unavailableRecordedAttempts" || key17 === "remainingKnownMicroUsd" || key17 === "reached")) {
                                    validate29.errors = [{ instancePath: instancePath + "/monthlyAdmission", schemaPath: "#/properties/monthlyAdmission/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key17 }, message: "must NOT have additional properties" }];
                                    return false;
                                    break;
                                  }
                                }
                                if (_errs218 === errors2) {
                                  if (data95.startInclusive !== void 0) {
                                    let data96 = data95.startInclusive;
                                    const _errs219 = errors2;
                                    if (errors2 === _errs219) {
                                      if (errors2 === _errs219) {
                                        if (typeof data96 === "string") {
                                          if (!pattern4.test(data96)) {
                                            validate29.errors = [{ instancePath: instancePath + "/monthlyAdmission/startInclusive", schemaPath: "#/properties/monthlyAdmission/properties/startInclusive/pattern", keyword: "pattern", params: { pattern: "Z$" }, message: 'must match pattern "Z$"' }];
                                            return false;
                                          } else {
                                            if (!formats0.validate(data96)) {
                                              validate29.errors = [{ instancePath: instancePath + "/monthlyAdmission/startInclusive", schemaPath: "#/properties/monthlyAdmission/properties/startInclusive/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' }];
                                              return false;
                                            }
                                          }
                                        } else {
                                          validate29.errors = [{ instancePath: instancePath + "/monthlyAdmission/startInclusive", schemaPath: "#/properties/monthlyAdmission/properties/startInclusive/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                          return false;
                                        }
                                      }
                                    }
                                    var valid24 = _errs219 === errors2;
                                  } else {
                                    var valid24 = true;
                                  }
                                  if (valid24) {
                                    if (data95.knownChargeMicroUsd !== void 0) {
                                      let data97 = data95.knownChargeMicroUsd;
                                      const _errs221 = errors2;
                                      if (!(typeof data97 == "number" && (!(data97 % 1) && !isNaN(data97)) && isFinite(data97))) {
                                        validate29.errors = [{ instancePath: instancePath + "/monthlyAdmission/knownChargeMicroUsd", schemaPath: "#/properties/monthlyAdmission/properties/knownChargeMicroUsd/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                        return false;
                                      }
                                      if (errors2 === _errs221) {
                                        if (typeof data97 == "number" && isFinite(data97)) {
                                          if (data97 > 9007199254740991 || isNaN(data97)) {
                                            validate29.errors = [{ instancePath: instancePath + "/monthlyAdmission/knownChargeMicroUsd", schemaPath: "#/properties/monthlyAdmission/properties/knownChargeMicroUsd/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                            return false;
                                          } else {
                                            if (data97 < 0 || isNaN(data97)) {
                                              validate29.errors = [{ instancePath: instancePath + "/monthlyAdmission/knownChargeMicroUsd", schemaPath: "#/properties/monthlyAdmission/properties/knownChargeMicroUsd/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                              return false;
                                            }
                                          }
                                        }
                                      }
                                      var valid24 = _errs221 === errors2;
                                    } else {
                                      var valid24 = true;
                                    }
                                    if (valid24) {
                                      if (data95.unavailableRecordedAttempts !== void 0) {
                                        let data98 = data95.unavailableRecordedAttempts;
                                        const _errs223 = errors2;
                                        if (!(typeof data98 == "number" && (!(data98 % 1) && !isNaN(data98)) && isFinite(data98))) {
                                          validate29.errors = [{ instancePath: instancePath + "/monthlyAdmission/unavailableRecordedAttempts", schemaPath: "#/properties/monthlyAdmission/properties/unavailableRecordedAttempts/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                          return false;
                                        }
                                        if (errors2 === _errs223) {
                                          if (typeof data98 == "number" && isFinite(data98)) {
                                            if (data98 > 9007199254740991 || isNaN(data98)) {
                                              validate29.errors = [{ instancePath: instancePath + "/monthlyAdmission/unavailableRecordedAttempts", schemaPath: "#/properties/monthlyAdmission/properties/unavailableRecordedAttempts/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                              return false;
                                            } else {
                                              if (data98 < 0 || isNaN(data98)) {
                                                validate29.errors = [{ instancePath: instancePath + "/monthlyAdmission/unavailableRecordedAttempts", schemaPath: "#/properties/monthlyAdmission/properties/unavailableRecordedAttempts/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                return false;
                                              }
                                            }
                                          }
                                        }
                                        var valid24 = _errs223 === errors2;
                                      } else {
                                        var valid24 = true;
                                      }
                                      if (valid24) {
                                        if (data95.remainingKnownMicroUsd !== void 0) {
                                          let data99 = data95.remainingKnownMicroUsd;
                                          const _errs225 = errors2;
                                          const _errs226 = errors2;
                                          let valid25 = false;
                                          const _errs227 = errors2;
                                          if (!(typeof data99 == "number" && (!(data99 % 1) && !isNaN(data99)) && isFinite(data99))) {
                                            const err50 = { instancePath: instancePath + "/monthlyAdmission/remainingKnownMicroUsd", schemaPath: "#/properties/monthlyAdmission/properties/remainingKnownMicroUsd/anyOf/0/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                            if (vErrors === null) {
                                              vErrors = [err50];
                                            } else {
                                              vErrors.push(err50);
                                            }
                                            errors2++;
                                          }
                                          if (errors2 === _errs227) {
                                            if (typeof data99 == "number" && isFinite(data99)) {
                                              if (data99 > 9007199254740991 || isNaN(data99)) {
                                                const err51 = { instancePath: instancePath + "/monthlyAdmission/remainingKnownMicroUsd", schemaPath: "#/properties/monthlyAdmission/properties/remainingKnownMicroUsd/anyOf/0/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                                if (vErrors === null) {
                                                  vErrors = [err51];
                                                } else {
                                                  vErrors.push(err51);
                                                }
                                                errors2++;
                                              } else {
                                                if (data99 < 0 || isNaN(data99)) {
                                                  const err52 = { instancePath: instancePath + "/monthlyAdmission/remainingKnownMicroUsd", schemaPath: "#/properties/monthlyAdmission/properties/remainingKnownMicroUsd/anyOf/0/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                                  if (vErrors === null) {
                                                    vErrors = [err52];
                                                  } else {
                                                    vErrors.push(err52);
                                                  }
                                                  errors2++;
                                                }
                                              }
                                            }
                                          }
                                          var _valid6 = _errs227 === errors2;
                                          valid25 = valid25 || _valid6;
                                          const _errs229 = errors2;
                                          if (data99 !== null) {
                                            const err53 = { instancePath: instancePath + "/monthlyAdmission/remainingKnownMicroUsd", schemaPath: "#/properties/monthlyAdmission/properties/remainingKnownMicroUsd/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                            if (vErrors === null) {
                                              vErrors = [err53];
                                            } else {
                                              vErrors.push(err53);
                                            }
                                            errors2++;
                                          }
                                          var _valid6 = _errs229 === errors2;
                                          valid25 = valid25 || _valid6;
                                          if (!valid25) {
                                            const err54 = { instancePath: instancePath + "/monthlyAdmission/remainingKnownMicroUsd", schemaPath: "#/properties/monthlyAdmission/properties/remainingKnownMicroUsd/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                            if (vErrors === null) {
                                              vErrors = [err54];
                                            } else {
                                              vErrors.push(err54);
                                            }
                                            errors2++;
                                            validate29.errors = vErrors;
                                            return false;
                                          } else {
                                            errors2 = _errs226;
                                            if (vErrors !== null) {
                                              if (_errs226) {
                                                vErrors.length = _errs226;
                                              } else {
                                                vErrors = null;
                                              }
                                            }
                                          }
                                          var valid24 = _errs225 === errors2;
                                        } else {
                                          var valid24 = true;
                                        }
                                        if (valid24) {
                                          if (data95.reached !== void 0) {
                                            let data100 = data95.reached;
                                            const _errs231 = errors2;
                                            const _errs232 = errors2;
                                            let valid26 = false;
                                            const _errs233 = errors2;
                                            if (typeof data100 !== "boolean") {
                                              const err55 = { instancePath: instancePath + "/monthlyAdmission/reached", schemaPath: "#/properties/monthlyAdmission/properties/reached/anyOf/0/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
                                              if (vErrors === null) {
                                                vErrors = [err55];
                                              } else {
                                                vErrors.push(err55);
                                              }
                                              errors2++;
                                            }
                                            var _valid7 = _errs233 === errors2;
                                            valid26 = valid26 || _valid7;
                                            const _errs235 = errors2;
                                            if (data100 !== null) {
                                              const err56 = { instancePath: instancePath + "/monthlyAdmission/reached", schemaPath: "#/properties/monthlyAdmission/properties/reached/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                              if (vErrors === null) {
                                                vErrors = [err56];
                                              } else {
                                                vErrors.push(err56);
                                              }
                                              errors2++;
                                            }
                                            var _valid7 = _errs235 === errors2;
                                            valid26 = valid26 || _valid7;
                                            if (!valid26) {
                                              const err57 = { instancePath: instancePath + "/monthlyAdmission/reached", schemaPath: "#/properties/monthlyAdmission/properties/reached/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                              if (vErrors === null) {
                                                vErrors = [err57];
                                              } else {
                                                vErrors.push(err57);
                                              }
                                              errors2++;
                                              validate29.errors = vErrors;
                                              return false;
                                            } else {
                                              errors2 = _errs232;
                                              if (vErrors !== null) {
                                                if (_errs232) {
                                                  vErrors.length = _errs232;
                                                } else {
                                                  vErrors = null;
                                                }
                                              }
                                            }
                                            var valid24 = _errs231 === errors2;
                                          } else {
                                            var valid24 = true;
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            } else {
                              validate29.errors = [{ instancePath: instancePath + "/monthlyAdmission", schemaPath: "#/properties/monthlyAdmission/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                              return false;
                            }
                          }
                          var valid0 = _errs216 === errors2;
                        } else {
                          var valid0 = true;
                        }
                        if (valid0) {
                          if (data.queue !== void 0) {
                            let data101 = data.queue;
                            const _errs237 = errors2;
                            if (errors2 === _errs237) {
                              if (data101 && typeof data101 == "object" && !Array.isArray(data101)) {
                                let missing18;
                                if (data101.basis === void 0 && (missing18 = "basis") || data101.states === void 0 && (missing18 = "states") || data101.physicalConcurrency === void 0 && (missing18 = "physicalConcurrency") || data101.availableCapacity === void 0 && (missing18 = "availableCapacity") || data101.capacityStatus === void 0 && (missing18 = "capacityStatus")) {
                                  validate29.errors = [{ instancePath: instancePath + "/queue", schemaPath: "#/properties/queue/required", keyword: "required", params: { missingProperty: missing18 }, message: "must have required property '" + missing18 + "'" }];
                                  return false;
                                } else {
                                  const _errs239 = errors2;
                                  for (const key18 in data101) {
                                    if (!(key18 === "basis" || key18 === "states" || key18 === "physicalConcurrency" || key18 === "availableCapacity" || key18 === "capacityStatus")) {
                                      validate29.errors = [{ instancePath: instancePath + "/queue", schemaPath: "#/properties/queue/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key18 }, message: "must NOT have additional properties" }];
                                      return false;
                                      break;
                                    }
                                  }
                                  if (_errs239 === errors2) {
                                    if (data101.basis !== void 0) {
                                      const _errs240 = errors2;
                                      if ("recorded-run-state" !== data101.basis) {
                                        validate29.errors = [{ instancePath: instancePath + "/queue/basis", schemaPath: "#/properties/queue/properties/basis/const", keyword: "const", params: { allowedValue: "recorded-run-state" }, message: "must be equal to constant" }];
                                        return false;
                                      }
                                      var valid27 = _errs240 === errors2;
                                    } else {
                                      var valid27 = true;
                                    }
                                    if (valid27) {
                                      if (data101.states !== void 0) {
                                        let data103 = data101.states;
                                        const _errs241 = errors2;
                                        if (errors2 === _errs241) {
                                          if (data103 && typeof data103 == "object" && !Array.isArray(data103)) {
                                            let missing19;
                                            if (data103.queued === void 0 && (missing19 = "queued") || data103.starting === void 0 && (missing19 = "starting") || data103.running === void 0 && (missing19 = "running") || data103["waiting-for-approval"] === void 0 && (missing19 = "waiting-for-approval") || data103.paused === void 0 && (missing19 = "paused") || data103.completed === void 0 && (missing19 = "completed") || data103.failed === void 0 && (missing19 = "failed") || data103.cancelled === void 0 && (missing19 = "cancelled")) {
                                              validate29.errors = [{ instancePath: instancePath + "/queue/states", schemaPath: "#/properties/queue/properties/states/required", keyword: "required", params: { missingProperty: missing19 }, message: "must have required property '" + missing19 + "'" }];
                                              return false;
                                            } else {
                                              const _errs243 = errors2;
                                              for (const key19 in data103) {
                                                if (!(key19 === "queued" || key19 === "starting" || key19 === "running" || key19 === "waiting-for-approval" || key19 === "paused" || key19 === "completed" || key19 === "failed" || key19 === "cancelled")) {
                                                  validate29.errors = [{ instancePath: instancePath + "/queue/states", schemaPath: "#/properties/queue/properties/states/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key19 }, message: "must NOT have additional properties" }];
                                                  return false;
                                                  break;
                                                }
                                              }
                                              if (_errs243 === errors2) {
                                                if (data103.queued !== void 0) {
                                                  let data104 = data103.queued;
                                                  const _errs244 = errors2;
                                                  if (!(typeof data104 == "number" && (!(data104 % 1) && !isNaN(data104)) && isFinite(data104))) {
                                                    validate29.errors = [{ instancePath: instancePath + "/queue/states/queued", schemaPath: "#/properties/queue/properties/states/properties/queued/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                    return false;
                                                  }
                                                  if (errors2 === _errs244) {
                                                    if (typeof data104 == "number" && isFinite(data104)) {
                                                      if (data104 > 9007199254740991 || isNaN(data104)) {
                                                        validate29.errors = [{ instancePath: instancePath + "/queue/states/queued", schemaPath: "#/properties/queue/properties/states/properties/queued/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                        return false;
                                                      } else {
                                                        if (data104 < 0 || isNaN(data104)) {
                                                          validate29.errors = [{ instancePath: instancePath + "/queue/states/queued", schemaPath: "#/properties/queue/properties/states/properties/queued/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                          return false;
                                                        }
                                                      }
                                                    }
                                                  }
                                                  var valid28 = _errs244 === errors2;
                                                } else {
                                                  var valid28 = true;
                                                }
                                                if (valid28) {
                                                  if (data103.starting !== void 0) {
                                                    let data105 = data103.starting;
                                                    const _errs246 = errors2;
                                                    if (!(typeof data105 == "number" && (!(data105 % 1) && !isNaN(data105)) && isFinite(data105))) {
                                                      validate29.errors = [{ instancePath: instancePath + "/queue/states/starting", schemaPath: "#/properties/queue/properties/states/properties/starting/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                      return false;
                                                    }
                                                    if (errors2 === _errs246) {
                                                      if (typeof data105 == "number" && isFinite(data105)) {
                                                        if (data105 > 9007199254740991 || isNaN(data105)) {
                                                          validate29.errors = [{ instancePath: instancePath + "/queue/states/starting", schemaPath: "#/properties/queue/properties/states/properties/starting/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                          return false;
                                                        } else {
                                                          if (data105 < 0 || isNaN(data105)) {
                                                            validate29.errors = [{ instancePath: instancePath + "/queue/states/starting", schemaPath: "#/properties/queue/properties/states/properties/starting/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                            return false;
                                                          }
                                                        }
                                                      }
                                                    }
                                                    var valid28 = _errs246 === errors2;
                                                  } else {
                                                    var valid28 = true;
                                                  }
                                                  if (valid28) {
                                                    if (data103.running !== void 0) {
                                                      let data106 = data103.running;
                                                      const _errs248 = errors2;
                                                      if (!(typeof data106 == "number" && (!(data106 % 1) && !isNaN(data106)) && isFinite(data106))) {
                                                        validate29.errors = [{ instancePath: instancePath + "/queue/states/running", schemaPath: "#/properties/queue/properties/states/properties/running/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                        return false;
                                                      }
                                                      if (errors2 === _errs248) {
                                                        if (typeof data106 == "number" && isFinite(data106)) {
                                                          if (data106 > 9007199254740991 || isNaN(data106)) {
                                                            validate29.errors = [{ instancePath: instancePath + "/queue/states/running", schemaPath: "#/properties/queue/properties/states/properties/running/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                            return false;
                                                          } else {
                                                            if (data106 < 0 || isNaN(data106)) {
                                                              validate29.errors = [{ instancePath: instancePath + "/queue/states/running", schemaPath: "#/properties/queue/properties/states/properties/running/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                              return false;
                                                            }
                                                          }
                                                        }
                                                      }
                                                      var valid28 = _errs248 === errors2;
                                                    } else {
                                                      var valid28 = true;
                                                    }
                                                    if (valid28) {
                                                      if (data103["waiting-for-approval"] !== void 0) {
                                                        let data107 = data103["waiting-for-approval"];
                                                        const _errs250 = errors2;
                                                        if (!(typeof data107 == "number" && (!(data107 % 1) && !isNaN(data107)) && isFinite(data107))) {
                                                          validate29.errors = [{ instancePath: instancePath + "/queue/states/waiting-for-approval", schemaPath: "#/properties/queue/properties/states/properties/waiting-for-approval/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                          return false;
                                                        }
                                                        if (errors2 === _errs250) {
                                                          if (typeof data107 == "number" && isFinite(data107)) {
                                                            if (data107 > 9007199254740991 || isNaN(data107)) {
                                                              validate29.errors = [{ instancePath: instancePath + "/queue/states/waiting-for-approval", schemaPath: "#/properties/queue/properties/states/properties/waiting-for-approval/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                              return false;
                                                            } else {
                                                              if (data107 < 0 || isNaN(data107)) {
                                                                validate29.errors = [{ instancePath: instancePath + "/queue/states/waiting-for-approval", schemaPath: "#/properties/queue/properties/states/properties/waiting-for-approval/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                return false;
                                                              }
                                                            }
                                                          }
                                                        }
                                                        var valid28 = _errs250 === errors2;
                                                      } else {
                                                        var valid28 = true;
                                                      }
                                                      if (valid28) {
                                                        if (data103.paused !== void 0) {
                                                          let data108 = data103.paused;
                                                          const _errs252 = errors2;
                                                          if (!(typeof data108 == "number" && (!(data108 % 1) && !isNaN(data108)) && isFinite(data108))) {
                                                            validate29.errors = [{ instancePath: instancePath + "/queue/states/paused", schemaPath: "#/properties/queue/properties/states/properties/paused/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                            return false;
                                                          }
                                                          if (errors2 === _errs252) {
                                                            if (typeof data108 == "number" && isFinite(data108)) {
                                                              if (data108 > 9007199254740991 || isNaN(data108)) {
                                                                validate29.errors = [{ instancePath: instancePath + "/queue/states/paused", schemaPath: "#/properties/queue/properties/states/properties/paused/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                return false;
                                                              } else {
                                                                if (data108 < 0 || isNaN(data108)) {
                                                                  validate29.errors = [{ instancePath: instancePath + "/queue/states/paused", schemaPath: "#/properties/queue/properties/states/properties/paused/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                  return false;
                                                                }
                                                              }
                                                            }
                                                          }
                                                          var valid28 = _errs252 === errors2;
                                                        } else {
                                                          var valid28 = true;
                                                        }
                                                        if (valid28) {
                                                          if (data103.completed !== void 0) {
                                                            let data109 = data103.completed;
                                                            const _errs254 = errors2;
                                                            if (!(typeof data109 == "number" && (!(data109 % 1) && !isNaN(data109)) && isFinite(data109))) {
                                                              validate29.errors = [{ instancePath: instancePath + "/queue/states/completed", schemaPath: "#/properties/queue/properties/states/properties/completed/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                              return false;
                                                            }
                                                            if (errors2 === _errs254) {
                                                              if (typeof data109 == "number" && isFinite(data109)) {
                                                                if (data109 > 9007199254740991 || isNaN(data109)) {
                                                                  validate29.errors = [{ instancePath: instancePath + "/queue/states/completed", schemaPath: "#/properties/queue/properties/states/properties/completed/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                  return false;
                                                                } else {
                                                                  if (data109 < 0 || isNaN(data109)) {
                                                                    validate29.errors = [{ instancePath: instancePath + "/queue/states/completed", schemaPath: "#/properties/queue/properties/states/properties/completed/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                    return false;
                                                                  }
                                                                }
                                                              }
                                                            }
                                                            var valid28 = _errs254 === errors2;
                                                          } else {
                                                            var valid28 = true;
                                                          }
                                                          if (valid28) {
                                                            if (data103.failed !== void 0) {
                                                              let data110 = data103.failed;
                                                              const _errs256 = errors2;
                                                              if (!(typeof data110 == "number" && (!(data110 % 1) && !isNaN(data110)) && isFinite(data110))) {
                                                                validate29.errors = [{ instancePath: instancePath + "/queue/states/failed", schemaPath: "#/properties/queue/properties/states/properties/failed/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                return false;
                                                              }
                                                              if (errors2 === _errs256) {
                                                                if (typeof data110 == "number" && isFinite(data110)) {
                                                                  if (data110 > 9007199254740991 || isNaN(data110)) {
                                                                    validate29.errors = [{ instancePath: instancePath + "/queue/states/failed", schemaPath: "#/properties/queue/properties/states/properties/failed/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                    return false;
                                                                  } else {
                                                                    if (data110 < 0 || isNaN(data110)) {
                                                                      validate29.errors = [{ instancePath: instancePath + "/queue/states/failed", schemaPath: "#/properties/queue/properties/states/properties/failed/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                      return false;
                                                                    }
                                                                  }
                                                                }
                                                              }
                                                              var valid28 = _errs256 === errors2;
                                                            } else {
                                                              var valid28 = true;
                                                            }
                                                            if (valid28) {
                                                              if (data103.cancelled !== void 0) {
                                                                let data111 = data103.cancelled;
                                                                const _errs258 = errors2;
                                                                if (!(typeof data111 == "number" && (!(data111 % 1) && !isNaN(data111)) && isFinite(data111))) {
                                                                  validate29.errors = [{ instancePath: instancePath + "/queue/states/cancelled", schemaPath: "#/properties/queue/properties/states/properties/cancelled/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                  return false;
                                                                }
                                                                if (errors2 === _errs258) {
                                                                  if (typeof data111 == "number" && isFinite(data111)) {
                                                                    if (data111 > 9007199254740991 || isNaN(data111)) {
                                                                      validate29.errors = [{ instancePath: instancePath + "/queue/states/cancelled", schemaPath: "#/properties/queue/properties/states/properties/cancelled/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                      return false;
                                                                    } else {
                                                                      if (data111 < 0 || isNaN(data111)) {
                                                                        validate29.errors = [{ instancePath: instancePath + "/queue/states/cancelled", schemaPath: "#/properties/queue/properties/states/properties/cancelled/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                        return false;
                                                                      }
                                                                    }
                                                                  }
                                                                }
                                                                var valid28 = _errs258 === errors2;
                                                              } else {
                                                                var valid28 = true;
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
                                            validate29.errors = [{ instancePath: instancePath + "/queue/states", schemaPath: "#/properties/queue/properties/states/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                            return false;
                                          }
                                        }
                                        var valid27 = _errs241 === errors2;
                                      } else {
                                        var valid27 = true;
                                      }
                                      if (valid27) {
                                        if (data101.physicalConcurrency !== void 0) {
                                          const _errs260 = errors2;
                                          if (data101.physicalConcurrency !== null) {
                                            validate29.errors = [{ instancePath: instancePath + "/queue/physicalConcurrency", schemaPath: "#/properties/queue/properties/physicalConcurrency/type", keyword: "type", params: { type: "null" }, message: "must be null" }];
                                            return false;
                                          }
                                          var valid27 = _errs260 === errors2;
                                        } else {
                                          var valid27 = true;
                                        }
                                        if (valid27) {
                                          if (data101.availableCapacity !== void 0) {
                                            const _errs262 = errors2;
                                            if (data101.availableCapacity !== null) {
                                              validate29.errors = [{ instancePath: instancePath + "/queue/availableCapacity", schemaPath: "#/properties/queue/properties/availableCapacity/type", keyword: "type", params: { type: "null" }, message: "must be null" }];
                                              return false;
                                            }
                                            var valid27 = _errs262 === errors2;
                                          } else {
                                            var valid27 = true;
                                          }
                                          if (valid27) {
                                            if (data101.capacityStatus !== void 0) {
                                              const _errs264 = errors2;
                                              if ("unavailable" !== data101.capacityStatus) {
                                                validate29.errors = [{ instancePath: instancePath + "/queue/capacityStatus", schemaPath: "#/properties/queue/properties/capacityStatus/const", keyword: "const", params: { allowedValue: "unavailable" }, message: "must be equal to constant" }];
                                                return false;
                                              }
                                              var valid27 = _errs264 === errors2;
                                            } else {
                                              var valid27 = true;
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              } else {
                                validate29.errors = [{ instancePath: instancePath + "/queue", schemaPath: "#/properties/queue/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                return false;
                              }
                            }
                            var valid0 = _errs237 === errors2;
                          } else {
                            var valid0 = true;
                          }
                          if (valid0) {
                            if (data.coverage !== void 0) {
                              let data115 = data.coverage;
                              const _errs265 = errors2;
                              if (errors2 === _errs265) {
                                if (data115 && typeof data115 == "object" && !Array.isArray(data115)) {
                                  let missing20;
                                  if (data115.attemptPeriodBasis === void 0 && (missing20 = "attemptPeriodBasis") || data115.admissionPeriodBasis === void 0 && (missing20 = "admissionPeriodBasis") || data115.chargeBasis === void 0 && (missing20 = "chargeBasis") || data115.providerBilledMicroUsd === void 0 && (missing20 = "providerBilledMicroUsd") || data115.completeJobCost === void 0 && (missing20 = "completeJobCost")) {
                                    validate29.errors = [{ instancePath: instancePath + "/coverage", schemaPath: "#/properties/coverage/required", keyword: "required", params: { missingProperty: missing20 }, message: "must have required property '" + missing20 + "'" }];
                                    return false;
                                  } else {
                                    const _errs267 = errors2;
                                    for (const key20 in data115) {
                                      if (!(key20 === "attemptPeriodBasis" || key20 === "admissionPeriodBasis" || key20 === "chargeBasis" || key20 === "providerBilledMicroUsd" || key20 === "completeJobCost")) {
                                        validate29.errors = [{ instancePath: instancePath + "/coverage", schemaPath: "#/properties/coverage/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key20 }, message: "must NOT have additional properties" }];
                                        return false;
                                        break;
                                      }
                                    }
                                    if (_errs267 === errors2) {
                                      if (data115.attemptPeriodBasis !== void 0) {
                                        const _errs268 = errors2;
                                        if ("run-created-at" !== data115.attemptPeriodBasis) {
                                          validate29.errors = [{ instancePath: instancePath + "/coverage/attemptPeriodBasis", schemaPath: "#/properties/coverage/properties/attemptPeriodBasis/const", keyword: "const", params: { allowedValue: "run-created-at" }, message: "must be equal to constant" }];
                                          return false;
                                        }
                                        var valid29 = _errs268 === errors2;
                                      } else {
                                        var valid29 = true;
                                      }
                                      if (valid29) {
                                        if (data115.admissionPeriodBasis !== void 0) {
                                          const _errs269 = errors2;
                                          if ("sdk-usage-recorded-at" !== data115.admissionPeriodBasis) {
                                            validate29.errors = [{ instancePath: instancePath + "/coverage/admissionPeriodBasis", schemaPath: "#/properties/coverage/properties/admissionPeriodBasis/const", keyword: "const", params: { allowedValue: "sdk-usage-recorded-at" }, message: "must be equal to constant" }];
                                            return false;
                                          }
                                          var valid29 = _errs269 === errors2;
                                        } else {
                                          var valid29 = true;
                                        }
                                        if (valid29) {
                                          if (data115.chargeBasis !== void 0) {
                                            const _errs270 = errors2;
                                            if ("sdk-list-estimate" !== data115.chargeBasis) {
                                              validate29.errors = [{ instancePath: instancePath + "/coverage/chargeBasis", schemaPath: "#/properties/coverage/properties/chargeBasis/const", keyword: "const", params: { allowedValue: "sdk-list-estimate" }, message: "must be equal to constant" }];
                                              return false;
                                            }
                                            var valid29 = _errs270 === errors2;
                                          } else {
                                            var valid29 = true;
                                          }
                                          if (valid29) {
                                            if (data115.providerBilledMicroUsd !== void 0) {
                                              const _errs271 = errors2;
                                              if (data115.providerBilledMicroUsd !== null) {
                                                validate29.errors = [{ instancePath: instancePath + "/coverage/providerBilledMicroUsd", schemaPath: "#/properties/coverage/properties/providerBilledMicroUsd/type", keyword: "type", params: { type: "null" }, message: "must be null" }];
                                                return false;
                                              }
                                              var valid29 = _errs271 === errors2;
                                            } else {
                                              var valid29 = true;
                                            }
                                            if (valid29) {
                                              if (data115.completeJobCost !== void 0) {
                                                const _errs273 = errors2;
                                                if ("estimated" !== data115.completeJobCost) {
                                                  validate29.errors = [{ instancePath: instancePath + "/coverage/completeJobCost", schemaPath: "#/properties/coverage/properties/completeJobCost/const", keyword: "const", params: { allowedValue: "estimated" }, message: "must be equal to constant" }];
                                                  return false;
                                                }
                                                var valid29 = _errs273 === errors2;
                                              } else {
                                                var valid29 = true;
                                              }
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }
                                } else {
                                  validate29.errors = [{ instancePath: instancePath + "/coverage", schemaPath: "#/properties/coverage/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                  return false;
                                }
                              }
                              var valid0 = _errs265 === errors2;
                            } else {
                              var valid0 = true;
                            }
                            if (valid0) {
                              if (data.denominators !== void 0) {
                                let data121 = data.denominators;
                                const _errs274 = errors2;
                                if (errors2 === _errs274) {
                                  if (data121 && typeof data121 == "object" && !Array.isArray(data121)) {
                                    let missing21;
                                    if (data121.attempts === void 0 && (missing21 = "attempts") || data121.conversationThreads === void 0 && (missing21 = "conversationThreads") || data121.sustainedJobs === void 0 && (missing21 = "sustainedJobs")) {
                                      validate29.errors = [{ instancePath: instancePath + "/denominators", schemaPath: "#/properties/denominators/required", keyword: "required", params: { missingProperty: missing21 }, message: "must have required property '" + missing21 + "'" }];
                                      return false;
                                    } else {
                                      const _errs276 = errors2;
                                      for (const key21 in data121) {
                                        if (!(key21 === "attempts" || key21 === "conversationThreads" || key21 === "sustainedJobs")) {
                                          validate29.errors = [{ instancePath: instancePath + "/denominators", schemaPath: "#/properties/denominators/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key21 }, message: "must NOT have additional properties" }];
                                          return false;
                                          break;
                                        }
                                      }
                                      if (_errs276 === errors2) {
                                        if (data121.attempts !== void 0) {
                                          const _errs277 = errors2;
                                          if ("run rows in the ledger; one run is one attempt or turn, never a job" !== data121.attempts) {
                                            validate29.errors = [{ instancePath: instancePath + "/denominators/attempts", schemaPath: "#/properties/denominators/properties/attempts/const", keyword: "const", params: { allowedValue: "run rows in the ledger; one run is one attempt or turn, never a job" }, message: "must be equal to constant" }];
                                            return false;
                                          }
                                          var valid30 = _errs277 === errors2;
                                        } else {
                                          var valid30 = true;
                                        }
                                        if (valid30) {
                                          if (data121.conversationThreads !== void 0) {
                                            const _errs278 = errors2;
                                            if ("distinct conversation_id with at least one run created in the period; a thread may host several attempts" !== data121.conversationThreads) {
                                              validate29.errors = [{ instancePath: instancePath + "/denominators/conversationThreads", schemaPath: "#/properties/denominators/properties/conversationThreads/const", keyword: "const", params: { allowedValue: "distinct conversation_id with at least one run created in the period; a thread may host several attempts" }, message: "must be equal to constant" }];
                                              return false;
                                            }
                                            var valid30 = _errs278 === errors2;
                                          } else {
                                            var valid30 = true;
                                          }
                                          if (valid30) {
                                            if (data121.sustainedJobs !== void 0) {
                                              const _errs279 = errors2;
                                              if ("canonical ROOT Work/Delegate objectives: the run whose stored request carries request.work with entry start-work|delegate, together with every run that continues it through the persisted continuation custody. A child assignment, conversation thread, SDK attempt or one completed run is never a job" !== data121.sustainedJobs) {
                                                validate29.errors = [{ instancePath: instancePath + "/denominators/sustainedJobs", schemaPath: "#/properties/denominators/properties/sustainedJobs/const", keyword: "const", params: { allowedValue: "canonical ROOT Work/Delegate objectives: the run whose stored request carries request.work with entry start-work|delegate, together with every run that continues it through the persisted continuation custody. A child assignment, conversation thread, SDK attempt or one completed run is never a job" }, message: "must be equal to constant" }];
                                                return false;
                                              }
                                              var valid30 = _errs279 === errors2;
                                            } else {
                                              var valid30 = true;
                                            }
                                          }
                                        }
                                      }
                                    }
                                  } else {
                                    validate29.errors = [{ instancePath: instancePath + "/denominators", schemaPath: "#/properties/denominators/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                    return false;
                                  }
                                }
                                var valid0 = _errs274 === errors2;
                              } else {
                                var valid0 = true;
                              }
                              if (valid0) {
                                if (data.jobIdentity !== void 0) {
                                  let data125 = data.jobIdentity;
                                  const _errs280 = errors2;
                                  if (errors2 === _errs280) {
                                    if (data125 && typeof data125 == "object" && !Array.isArray(data125)) {
                                      let missing22;
                                      if (data125.status === void 0 && (missing22 = "status") || data125.definition === void 0 && (missing22 = "definition") || data125.lineage === void 0 && (missing22 = "lineage") || data125.closure === void 0 && (missing22 = "closure") || data125.owner === void 0 && (missing22 = "owner") || data125.states === void 0 && (missing22 = "states")) {
                                        validate29.errors = [{ instancePath: instancePath + "/jobIdentity", schemaPath: "#/properties/jobIdentity/required", keyword: "required", params: { missingProperty: missing22 }, message: "must have required property '" + missing22 + "'" }];
                                        return false;
                                      } else {
                                        const _errs282 = errors2;
                                        for (const key22 in data125) {
                                          if (!(key22 === "status" || key22 === "definition" || key22 === "lineage" || key22 === "closure" || key22 === "owner" || key22 === "states")) {
                                            validate29.errors = [{ instancePath: instancePath + "/jobIdentity", schemaPath: "#/properties/jobIdentity/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key22 }, message: "must NOT have additional properties" }];
                                            return false;
                                            break;
                                          }
                                        }
                                        if (_errs282 === errors2) {
                                          if (data125.status !== void 0) {
                                            const _errs283 = errors2;
                                            if ("measured" !== data125.status) {
                                              validate29.errors = [{ instancePath: instancePath + "/jobIdentity/status", schemaPath: "#/properties/jobIdentity/properties/status/const", keyword: "const", params: { allowedValue: "measured" }, message: "must be equal to constant" }];
                                              return false;
                                            }
                                            var valid31 = _errs283 === errors2;
                                          } else {
                                            var valid31 = true;
                                          }
                                          if (valid31) {
                                            if (data125.definition !== void 0) {
                                              const _errs284 = errors2;
                                              if ("one whole job is the canonical ROOT Work/Delegate objective across its continuations and current goal revision; it is never a child assignment, conversation thread, SDK attempt or one completed run" !== data125.definition) {
                                                validate29.errors = [{ instancePath: instancePath + "/jobIdentity/definition", schemaPath: "#/properties/jobIdentity/properties/definition/const", keyword: "const", params: { allowedValue: "one whole job is the canonical ROOT Work/Delegate objective across its continuations and current goal revision; it is never a child assignment, conversation thread, SDK attempt or one completed run" }, message: "must be equal to constant" }];
                                                return false;
                                              }
                                              var valid31 = _errs284 === errors2;
                                            } else {
                                              var valid31 = true;
                                            }
                                            if (valid31) {
                                              if (data125.lineage !== void 0) {
                                                const _errs285 = errors2;
                                                if ("a run continues another objective only when the canonical continuation owner verifies that run stored continuation envelope in the same transaction and that envelope is a resume naming that source run stored request, so its source request digest equals the source run request_sha256; a fork and a run without that verified custody each start a new objective, because the canonical prompt identity owner makes a fork and a next prompt new logical prompts" !== data125.lineage) {
                                                  validate29.errors = [{ instancePath: instancePath + "/jobIdentity/lineage", schemaPath: "#/properties/jobIdentity/properties/lineage/const", keyword: "const", params: { allowedValue: "a run continues another objective only when the canonical continuation owner verifies that run stored continuation envelope in the same transaction and that envelope is a resume naming that source run stored request, so its source request digest equals the source run request_sha256; a fork and a run without that verified custody each start a new objective, because the canonical prompt identity owner makes a fork and a next prompt new logical prompts" }, message: "must be equal to constant" }];
                                                  return false;
                                                }
                                                var valid31 = _errs285 === errors2;
                                              } else {
                                                var valid31 = true;
                                              }
                                              if (valid31) {
                                                if (data125.closure !== void 0) {
                                                  const _errs286 = errors2;
                                                  if ("the existing completion producer decides. successful = every current revision is completed and carries a PUBLISHED native-session completion capture whose identity pins that revision, with no unresolved successor and no unsettled child receipt; failed = every current revision reached failed; cancelled = every current revision reached cancelled; partial = a current revision is still in flight, or terminal revisions carry mixed outcomes; unclosed = a current revision is terminal without that closure proof, or a continuation control is unresolved (not APPLIED, or its successor revision is outside this read window), or a child receipt is unresolved" !== data125.closure) {
                                                    validate29.errors = [{ instancePath: instancePath + "/jobIdentity/closure", schemaPath: "#/properties/jobIdentity/properties/closure/const", keyword: "const", params: { allowedValue: "the existing completion producer decides. successful = every current revision is completed and carries a PUBLISHED native-session completion capture whose identity pins that revision, with no unresolved successor and no unsettled child receipt; failed = every current revision reached failed; cancelled = every current revision reached cancelled; partial = a current revision is still in flight, or terminal revisions carry mixed outcomes; unclosed = a current revision is terminal without that closure proof, or a continuation control is unresolved (not APPLIED, or its successor revision is outside this read window), or a child receipt is unresolved" }, message: "must be equal to constant" }];
                                                    return false;
                                                  }
                                                  var valid31 = _errs286 === errors2;
                                                } else {
                                                  var valid31 = true;
                                                }
                                                if (valid31) {
                                                  if (data125.owner !== void 0) {
                                                    const _errs287 = errors2;
                                                    if ("the existing lifecycle completion producer (meri_conversations.completion_checkpoints) read over the existing run and control lineage; no second store, ledger, scheduler or table is created" !== data125.owner) {
                                                      validate29.errors = [{ instancePath: instancePath + "/jobIdentity/owner", schemaPath: "#/properties/jobIdentity/properties/owner/const", keyword: "const", params: { allowedValue: "the existing lifecycle completion producer (meri_conversations.completion_checkpoints) read over the existing run and control lineage; no second store, ledger, scheduler or table is created" }, message: "must be equal to constant" }];
                                                      return false;
                                                    }
                                                    var valid31 = _errs287 === errors2;
                                                  } else {
                                                    var valid31 = true;
                                                  }
                                                  if (valid31) {
                                                    if (data125.states !== void 0) {
                                                      let data131 = data125.states;
                                                      const _errs288 = errors2;
                                                      if (errors2 === _errs288) {
                                                        if (Array.isArray(data131)) {
                                                          if (data131.length > 5) {
                                                            validate29.errors = [{ instancePath: instancePath + "/jobIdentity/states", schemaPath: "#/properties/jobIdentity/properties/states/maxItems", keyword: "maxItems", params: { limit: 5 }, message: "must NOT have more than 5 items" }];
                                                            return false;
                                                          } else {
                                                            if (data131.length < 5) {
                                                              validate29.errors = [{ instancePath: instancePath + "/jobIdentity/states", schemaPath: "#/properties/jobIdentity/properties/states/minItems", keyword: "minItems", params: { limit: 5 }, message: "must NOT have fewer than 5 items" }];
                                                              return false;
                                                            } else {
                                                              var valid32 = true;
                                                              const len1 = data131.length;
                                                              for (let i1 = 0; i1 < len1; i1++) {
                                                                let data132 = data131[i1];
                                                                const _errs290 = errors2;
                                                                if (!(data132 === "successful" || data132 === "partial" || data132 === "failed" || data132 === "cancelled" || data132 === "unclosed")) {
                                                                  validate29.errors = [{ instancePath: instancePath + "/jobIdentity/states/" + i1, schemaPath: "#/properties/jobIdentity/properties/states/items/enum", keyword: "enum", params: { allowedValues: schema40.properties.jobIdentity.properties.states.items.enum }, message: "must be equal to one of the allowed values" }];
                                                                  return false;
                                                                }
                                                                var valid32 = _errs290 === errors2;
                                                                if (!valid32) {
                                                                  break;
                                                                }
                                                              }
                                                            }
                                                          }
                                                        } else {
                                                          validate29.errors = [{ instancePath: instancePath + "/jobIdentity/states", schemaPath: "#/properties/jobIdentity/properties/states/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                                          return false;
                                                        }
                                                      }
                                                      var valid31 = _errs288 === errors2;
                                                    } else {
                                                      var valid31 = true;
                                                    }
                                                  }
                                                }
                                              }
                                            }
                                          }
                                        }
                                      }
                                    } else {
                                      validate29.errors = [{ instancePath: instancePath + "/jobIdentity", schemaPath: "#/properties/jobIdentity/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                      return false;
                                    }
                                  }
                                  var valid0 = _errs280 === errors2;
                                } else {
                                  var valid0 = true;
                                }
                                if (valid0) {
                                  if (data.wholeJobs !== void 0) {
                                    let data133 = data.wholeJobs;
                                    const _errs291 = errors2;
                                    if (errors2 === _errs291) {
                                      if (data133 && typeof data133 == "object" && !Array.isArray(data133)) {
                                        let missing23;
                                        if (data133.basis === void 0 && (missing23 = "basis") || data133.window === void 0 && (missing23 = "window") || data133.states === void 0 && (missing23 = "states") || data133.jobs === void 0 && (missing23 = "jobs") || data133.attempts === void 0 && (missing23 = "attempts") || data133.revisions === void 0 && (missing23 = "revisions") || data133.steerRevisions === void 0 && (missing23 = "steerRevisions") || data133.tails === void 0 && (missing23 = "tails") || data133.settledRevisions === void 0 && (missing23 = "settledRevisions") || data133.closurePending === void 0 && (missing23 = "closurePending") || data133.unresolvedSuccessors === void 0 && (missing23 = "unresolvedSuccessors") || data133.unsettledChildren === void 0 && (missing23 = "unsettledChildren") || data133.knownChargeMicroUsd === void 0 && (missing23 = "knownChargeMicroUsd") || data133.microUsdPerSuccessfulJob === void 0 && (missing23 = "microUsdPerSuccessfulJob") || data133.coverage === void 0 && (missing23 = "coverage")) {
                                          validate29.errors = [{ instancePath: instancePath + "/wholeJobs", schemaPath: "#/properties/wholeJobs/required", keyword: "required", params: { missingProperty: missing23 }, message: "must have required property '" + missing23 + "'" }];
                                          return false;
                                        } else {
                                          const _errs293 = errors2;
                                          for (const key23 in data133) {
                                            if (!func1.call(schema40.properties.wholeJobs.properties, key23)) {
                                              validate29.errors = [{ instancePath: instancePath + "/wholeJobs", schemaPath: "#/properties/wholeJobs/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key23 }, message: "must NOT have additional properties" }];
                                              return false;
                                              break;
                                            }
                                          }
                                          if (_errs293 === errors2) {
                                            if (data133.basis !== void 0) {
                                              const _errs294 = errors2;
                                              if ("canonical ROOT Work/Delegate objectives: the run whose stored request carries request.work with entry start-work|delegate, together with every run that continues it through the persisted continuation custody. A child assignment, conversation thread, SDK attempt or one completed run is never a job" !== data133.basis) {
                                                validate29.errors = [{ instancePath: instancePath + "/wholeJobs/basis", schemaPath: "#/properties/wholeJobs/properties/basis/const", keyword: "const", params: { allowedValue: "canonical ROOT Work/Delegate objectives: the run whose stored request carries request.work with entry start-work|delegate, together with every run that continues it through the persisted continuation custody. A child assignment, conversation thread, SDK attempt or one completed run is never a job" }, message: "must be equal to constant" }];
                                                return false;
                                              }
                                              var valid33 = _errs294 === errors2;
                                            } else {
                                              var valid33 = true;
                                            }
                                            if (valid33) {
                                              if (data133.window !== void 0) {
                                                const _errs295 = errors2;
                                                if ("root revision created within the admitted month window" !== data133.window) {
                                                  validate29.errors = [{ instancePath: instancePath + "/wholeJobs/window", schemaPath: "#/properties/wholeJobs/properties/window/const", keyword: "const", params: { allowedValue: "root revision created within the admitted month window" }, message: "must be equal to constant" }];
                                                  return false;
                                                }
                                                var valid33 = _errs295 === errors2;
                                              } else {
                                                var valid33 = true;
                                              }
                                              if (valid33) {
                                                if (data133.states !== void 0) {
                                                  let data136 = data133.states;
                                                  const _errs296 = errors2;
                                                  if (errors2 === _errs296) {
                                                    if (data136 && typeof data136 == "object" && !Array.isArray(data136)) {
                                                      let missing24;
                                                      if (data136.successful === void 0 && (missing24 = "successful") || data136.partial === void 0 && (missing24 = "partial") || data136.failed === void 0 && (missing24 = "failed") || data136.cancelled === void 0 && (missing24 = "cancelled") || data136.unclosed === void 0 && (missing24 = "unclosed")) {
                                                        validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states", schemaPath: "#/properties/wholeJobs/properties/states/required", keyword: "required", params: { missingProperty: missing24 }, message: "must have required property '" + missing24 + "'" }];
                                                        return false;
                                                      } else {
                                                        const _errs298 = errors2;
                                                        for (const key24 in data136) {
                                                          if (!(key24 === "successful" || key24 === "partial" || key24 === "failed" || key24 === "cancelled" || key24 === "unclosed")) {
                                                            validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states", schemaPath: "#/properties/wholeJobs/properties/states/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key24 }, message: "must NOT have additional properties" }];
                                                            return false;
                                                            break;
                                                          }
                                                        }
                                                        if (_errs298 === errors2) {
                                                          if (data136.successful !== void 0) {
                                                            let data137 = data136.successful;
                                                            const _errs299 = errors2;
                                                            if (errors2 === _errs299) {
                                                              if (data137 && typeof data137 == "object" && !Array.isArray(data137)) {
                                                                let missing25;
                                                                if (data137.jobs === void 0 && (missing25 = "jobs") || data137.attempts === void 0 && (missing25 = "attempts") || data137.knownChargeMicroUsd === void 0 && (missing25 = "knownChargeMicroUsd")) {
                                                                  validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/successful", schemaPath: "#/properties/wholeJobs/properties/states/properties/successful/required", keyword: "required", params: { missingProperty: missing25 }, message: "must have required property '" + missing25 + "'" }];
                                                                  return false;
                                                                } else {
                                                                  const _errs301 = errors2;
                                                                  for (const key25 in data137) {
                                                                    if (!(key25 === "jobs" || key25 === "attempts" || key25 === "knownChargeMicroUsd")) {
                                                                      validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/successful", schemaPath: "#/properties/wholeJobs/properties/states/properties/successful/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key25 }, message: "must NOT have additional properties" }];
                                                                      return false;
                                                                      break;
                                                                    }
                                                                  }
                                                                  if (_errs301 === errors2) {
                                                                    if (data137.jobs !== void 0) {
                                                                      let data138 = data137.jobs;
                                                                      const _errs302 = errors2;
                                                                      if (!(typeof data138 == "number" && (!(data138 % 1) && !isNaN(data138)) && isFinite(data138))) {
                                                                        validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/successful/jobs", schemaPath: "#/properties/wholeJobs/properties/states/properties/successful/properties/jobs/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                        return false;
                                                                      }
                                                                      if (errors2 === _errs302) {
                                                                        if (typeof data138 == "number" && isFinite(data138)) {
                                                                          if (data138 > 9007199254740991 || isNaN(data138)) {
                                                                            validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/successful/jobs", schemaPath: "#/properties/wholeJobs/properties/states/properties/successful/properties/jobs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                            return false;
                                                                          } else {
                                                                            if (data138 < 0 || isNaN(data138)) {
                                                                              validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/successful/jobs", schemaPath: "#/properties/wholeJobs/properties/states/properties/successful/properties/jobs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                              return false;
                                                                            }
                                                                          }
                                                                        }
                                                                      }
                                                                      var valid35 = _errs302 === errors2;
                                                                    } else {
                                                                      var valid35 = true;
                                                                    }
                                                                    if (valid35) {
                                                                      if (data137.attempts !== void 0) {
                                                                        let data139 = data137.attempts;
                                                                        const _errs304 = errors2;
                                                                        if (!(typeof data139 == "number" && (!(data139 % 1) && !isNaN(data139)) && isFinite(data139))) {
                                                                          validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/successful/attempts", schemaPath: "#/properties/wholeJobs/properties/states/properties/successful/properties/attempts/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                          return false;
                                                                        }
                                                                        if (errors2 === _errs304) {
                                                                          if (typeof data139 == "number" && isFinite(data139)) {
                                                                            if (data139 > 9007199254740991 || isNaN(data139)) {
                                                                              validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/successful/attempts", schemaPath: "#/properties/wholeJobs/properties/states/properties/successful/properties/attempts/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                              return false;
                                                                            } else {
                                                                              if (data139 < 0 || isNaN(data139)) {
                                                                                validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/successful/attempts", schemaPath: "#/properties/wholeJobs/properties/states/properties/successful/properties/attempts/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                return false;
                                                                              }
                                                                            }
                                                                          }
                                                                        }
                                                                        var valid35 = _errs304 === errors2;
                                                                      } else {
                                                                        var valid35 = true;
                                                                      }
                                                                      if (valid35) {
                                                                        if (data137.knownChargeMicroUsd !== void 0) {
                                                                          let data140 = data137.knownChargeMicroUsd;
                                                                          const _errs306 = errors2;
                                                                          if (!(typeof data140 == "number" && (!(data140 % 1) && !isNaN(data140)) && isFinite(data140))) {
                                                                            validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/successful/knownChargeMicroUsd", schemaPath: "#/properties/wholeJobs/properties/states/properties/successful/properties/knownChargeMicroUsd/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                            return false;
                                                                          }
                                                                          if (errors2 === _errs306) {
                                                                            if (typeof data140 == "number" && isFinite(data140)) {
                                                                              if (data140 > 9007199254740991 || isNaN(data140)) {
                                                                                validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/successful/knownChargeMicroUsd", schemaPath: "#/properties/wholeJobs/properties/states/properties/successful/properties/knownChargeMicroUsd/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                return false;
                                                                              } else {
                                                                                if (data140 < 0 || isNaN(data140)) {
                                                                                  validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/successful/knownChargeMicroUsd", schemaPath: "#/properties/wholeJobs/properties/states/properties/successful/properties/knownChargeMicroUsd/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                  return false;
                                                                                }
                                                                              }
                                                                            }
                                                                          }
                                                                          var valid35 = _errs306 === errors2;
                                                                        } else {
                                                                          var valid35 = true;
                                                                        }
                                                                      }
                                                                    }
                                                                  }
                                                                }
                                                              } else {
                                                                validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/successful", schemaPath: "#/properties/wholeJobs/properties/states/properties/successful/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                                return false;
                                                              }
                                                            }
                                                            var valid34 = _errs299 === errors2;
                                                          } else {
                                                            var valid34 = true;
                                                          }
                                                          if (valid34) {
                                                            if (data136.partial !== void 0) {
                                                              let data141 = data136.partial;
                                                              const _errs308 = errors2;
                                                              if (errors2 === _errs308) {
                                                                if (data141 && typeof data141 == "object" && !Array.isArray(data141)) {
                                                                  let missing26;
                                                                  if (data141.jobs === void 0 && (missing26 = "jobs") || data141.attempts === void 0 && (missing26 = "attempts") || data141.knownChargeMicroUsd === void 0 && (missing26 = "knownChargeMicroUsd")) {
                                                                    validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/partial", schemaPath: "#/properties/wholeJobs/properties/states/properties/partial/required", keyword: "required", params: { missingProperty: missing26 }, message: "must have required property '" + missing26 + "'" }];
                                                                    return false;
                                                                  } else {
                                                                    const _errs310 = errors2;
                                                                    for (const key26 in data141) {
                                                                      if (!(key26 === "jobs" || key26 === "attempts" || key26 === "knownChargeMicroUsd")) {
                                                                        validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/partial", schemaPath: "#/properties/wholeJobs/properties/states/properties/partial/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key26 }, message: "must NOT have additional properties" }];
                                                                        return false;
                                                                        break;
                                                                      }
                                                                    }
                                                                    if (_errs310 === errors2) {
                                                                      if (data141.jobs !== void 0) {
                                                                        let data142 = data141.jobs;
                                                                        const _errs311 = errors2;
                                                                        if (!(typeof data142 == "number" && (!(data142 % 1) && !isNaN(data142)) && isFinite(data142))) {
                                                                          validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/partial/jobs", schemaPath: "#/properties/wholeJobs/properties/states/properties/partial/properties/jobs/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                          return false;
                                                                        }
                                                                        if (errors2 === _errs311) {
                                                                          if (typeof data142 == "number" && isFinite(data142)) {
                                                                            if (data142 > 9007199254740991 || isNaN(data142)) {
                                                                              validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/partial/jobs", schemaPath: "#/properties/wholeJobs/properties/states/properties/partial/properties/jobs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                              return false;
                                                                            } else {
                                                                              if (data142 < 0 || isNaN(data142)) {
                                                                                validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/partial/jobs", schemaPath: "#/properties/wholeJobs/properties/states/properties/partial/properties/jobs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                return false;
                                                                              }
                                                                            }
                                                                          }
                                                                        }
                                                                        var valid36 = _errs311 === errors2;
                                                                      } else {
                                                                        var valid36 = true;
                                                                      }
                                                                      if (valid36) {
                                                                        if (data141.attempts !== void 0) {
                                                                          let data143 = data141.attempts;
                                                                          const _errs313 = errors2;
                                                                          if (!(typeof data143 == "number" && (!(data143 % 1) && !isNaN(data143)) && isFinite(data143))) {
                                                                            validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/partial/attempts", schemaPath: "#/properties/wholeJobs/properties/states/properties/partial/properties/attempts/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                            return false;
                                                                          }
                                                                          if (errors2 === _errs313) {
                                                                            if (typeof data143 == "number" && isFinite(data143)) {
                                                                              if (data143 > 9007199254740991 || isNaN(data143)) {
                                                                                validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/partial/attempts", schemaPath: "#/properties/wholeJobs/properties/states/properties/partial/properties/attempts/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                return false;
                                                                              } else {
                                                                                if (data143 < 0 || isNaN(data143)) {
                                                                                  validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/partial/attempts", schemaPath: "#/properties/wholeJobs/properties/states/properties/partial/properties/attempts/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                  return false;
                                                                                }
                                                                              }
                                                                            }
                                                                          }
                                                                          var valid36 = _errs313 === errors2;
                                                                        } else {
                                                                          var valid36 = true;
                                                                        }
                                                                        if (valid36) {
                                                                          if (data141.knownChargeMicroUsd !== void 0) {
                                                                            let data144 = data141.knownChargeMicroUsd;
                                                                            const _errs315 = errors2;
                                                                            if (!(typeof data144 == "number" && (!(data144 % 1) && !isNaN(data144)) && isFinite(data144))) {
                                                                              validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/partial/knownChargeMicroUsd", schemaPath: "#/properties/wholeJobs/properties/states/properties/partial/properties/knownChargeMicroUsd/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                              return false;
                                                                            }
                                                                            if (errors2 === _errs315) {
                                                                              if (typeof data144 == "number" && isFinite(data144)) {
                                                                                if (data144 > 9007199254740991 || isNaN(data144)) {
                                                                                  validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/partial/knownChargeMicroUsd", schemaPath: "#/properties/wholeJobs/properties/states/properties/partial/properties/knownChargeMicroUsd/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                  return false;
                                                                                } else {
                                                                                  if (data144 < 0 || isNaN(data144)) {
                                                                                    validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/partial/knownChargeMicroUsd", schemaPath: "#/properties/wholeJobs/properties/states/properties/partial/properties/knownChargeMicroUsd/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                    return false;
                                                                                  }
                                                                                }
                                                                              }
                                                                            }
                                                                            var valid36 = _errs315 === errors2;
                                                                          } else {
                                                                            var valid36 = true;
                                                                          }
                                                                        }
                                                                      }
                                                                    }
                                                                  }
                                                                } else {
                                                                  validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/partial", schemaPath: "#/properties/wholeJobs/properties/states/properties/partial/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                                  return false;
                                                                }
                                                              }
                                                              var valid34 = _errs308 === errors2;
                                                            } else {
                                                              var valid34 = true;
                                                            }
                                                            if (valid34) {
                                                              if (data136.failed !== void 0) {
                                                                let data145 = data136.failed;
                                                                const _errs317 = errors2;
                                                                if (errors2 === _errs317) {
                                                                  if (data145 && typeof data145 == "object" && !Array.isArray(data145)) {
                                                                    let missing27;
                                                                    if (data145.jobs === void 0 && (missing27 = "jobs") || data145.attempts === void 0 && (missing27 = "attempts") || data145.knownChargeMicroUsd === void 0 && (missing27 = "knownChargeMicroUsd")) {
                                                                      validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/failed", schemaPath: "#/properties/wholeJobs/properties/states/properties/failed/required", keyword: "required", params: { missingProperty: missing27 }, message: "must have required property '" + missing27 + "'" }];
                                                                      return false;
                                                                    } else {
                                                                      const _errs319 = errors2;
                                                                      for (const key27 in data145) {
                                                                        if (!(key27 === "jobs" || key27 === "attempts" || key27 === "knownChargeMicroUsd")) {
                                                                          validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/failed", schemaPath: "#/properties/wholeJobs/properties/states/properties/failed/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key27 }, message: "must NOT have additional properties" }];
                                                                          return false;
                                                                          break;
                                                                        }
                                                                      }
                                                                      if (_errs319 === errors2) {
                                                                        if (data145.jobs !== void 0) {
                                                                          let data146 = data145.jobs;
                                                                          const _errs320 = errors2;
                                                                          if (!(typeof data146 == "number" && (!(data146 % 1) && !isNaN(data146)) && isFinite(data146))) {
                                                                            validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/failed/jobs", schemaPath: "#/properties/wholeJobs/properties/states/properties/failed/properties/jobs/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                            return false;
                                                                          }
                                                                          if (errors2 === _errs320) {
                                                                            if (typeof data146 == "number" && isFinite(data146)) {
                                                                              if (data146 > 9007199254740991 || isNaN(data146)) {
                                                                                validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/failed/jobs", schemaPath: "#/properties/wholeJobs/properties/states/properties/failed/properties/jobs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                return false;
                                                                              } else {
                                                                                if (data146 < 0 || isNaN(data146)) {
                                                                                  validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/failed/jobs", schemaPath: "#/properties/wholeJobs/properties/states/properties/failed/properties/jobs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                  return false;
                                                                                }
                                                                              }
                                                                            }
                                                                          }
                                                                          var valid37 = _errs320 === errors2;
                                                                        } else {
                                                                          var valid37 = true;
                                                                        }
                                                                        if (valid37) {
                                                                          if (data145.attempts !== void 0) {
                                                                            let data147 = data145.attempts;
                                                                            const _errs322 = errors2;
                                                                            if (!(typeof data147 == "number" && (!(data147 % 1) && !isNaN(data147)) && isFinite(data147))) {
                                                                              validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/failed/attempts", schemaPath: "#/properties/wholeJobs/properties/states/properties/failed/properties/attempts/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                              return false;
                                                                            }
                                                                            if (errors2 === _errs322) {
                                                                              if (typeof data147 == "number" && isFinite(data147)) {
                                                                                if (data147 > 9007199254740991 || isNaN(data147)) {
                                                                                  validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/failed/attempts", schemaPath: "#/properties/wholeJobs/properties/states/properties/failed/properties/attempts/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                  return false;
                                                                                } else {
                                                                                  if (data147 < 0 || isNaN(data147)) {
                                                                                    validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/failed/attempts", schemaPath: "#/properties/wholeJobs/properties/states/properties/failed/properties/attempts/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                    return false;
                                                                                  }
                                                                                }
                                                                              }
                                                                            }
                                                                            var valid37 = _errs322 === errors2;
                                                                          } else {
                                                                            var valid37 = true;
                                                                          }
                                                                          if (valid37) {
                                                                            if (data145.knownChargeMicroUsd !== void 0) {
                                                                              let data148 = data145.knownChargeMicroUsd;
                                                                              const _errs324 = errors2;
                                                                              if (!(typeof data148 == "number" && (!(data148 % 1) && !isNaN(data148)) && isFinite(data148))) {
                                                                                validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/failed/knownChargeMicroUsd", schemaPath: "#/properties/wholeJobs/properties/states/properties/failed/properties/knownChargeMicroUsd/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                return false;
                                                                              }
                                                                              if (errors2 === _errs324) {
                                                                                if (typeof data148 == "number" && isFinite(data148)) {
                                                                                  if (data148 > 9007199254740991 || isNaN(data148)) {
                                                                                    validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/failed/knownChargeMicroUsd", schemaPath: "#/properties/wholeJobs/properties/states/properties/failed/properties/knownChargeMicroUsd/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                    return false;
                                                                                  } else {
                                                                                    if (data148 < 0 || isNaN(data148)) {
                                                                                      validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/failed/knownChargeMicroUsd", schemaPath: "#/properties/wholeJobs/properties/states/properties/failed/properties/knownChargeMicroUsd/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                      return false;
                                                                                    }
                                                                                  }
                                                                                }
                                                                              }
                                                                              var valid37 = _errs324 === errors2;
                                                                            } else {
                                                                              var valid37 = true;
                                                                            }
                                                                          }
                                                                        }
                                                                      }
                                                                    }
                                                                  } else {
                                                                    validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/failed", schemaPath: "#/properties/wholeJobs/properties/states/properties/failed/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                                    return false;
                                                                  }
                                                                }
                                                                var valid34 = _errs317 === errors2;
                                                              } else {
                                                                var valid34 = true;
                                                              }
                                                              if (valid34) {
                                                                if (data136.cancelled !== void 0) {
                                                                  let data149 = data136.cancelled;
                                                                  const _errs326 = errors2;
                                                                  if (errors2 === _errs326) {
                                                                    if (data149 && typeof data149 == "object" && !Array.isArray(data149)) {
                                                                      let missing28;
                                                                      if (data149.jobs === void 0 && (missing28 = "jobs") || data149.attempts === void 0 && (missing28 = "attempts") || data149.knownChargeMicroUsd === void 0 && (missing28 = "knownChargeMicroUsd")) {
                                                                        validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/cancelled", schemaPath: "#/properties/wholeJobs/properties/states/properties/cancelled/required", keyword: "required", params: { missingProperty: missing28 }, message: "must have required property '" + missing28 + "'" }];
                                                                        return false;
                                                                      } else {
                                                                        const _errs328 = errors2;
                                                                        for (const key28 in data149) {
                                                                          if (!(key28 === "jobs" || key28 === "attempts" || key28 === "knownChargeMicroUsd")) {
                                                                            validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/cancelled", schemaPath: "#/properties/wholeJobs/properties/states/properties/cancelled/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key28 }, message: "must NOT have additional properties" }];
                                                                            return false;
                                                                            break;
                                                                          }
                                                                        }
                                                                        if (_errs328 === errors2) {
                                                                          if (data149.jobs !== void 0) {
                                                                            let data150 = data149.jobs;
                                                                            const _errs329 = errors2;
                                                                            if (!(typeof data150 == "number" && (!(data150 % 1) && !isNaN(data150)) && isFinite(data150))) {
                                                                              validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/cancelled/jobs", schemaPath: "#/properties/wholeJobs/properties/states/properties/cancelled/properties/jobs/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                              return false;
                                                                            }
                                                                            if (errors2 === _errs329) {
                                                                              if (typeof data150 == "number" && isFinite(data150)) {
                                                                                if (data150 > 9007199254740991 || isNaN(data150)) {
                                                                                  validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/cancelled/jobs", schemaPath: "#/properties/wholeJobs/properties/states/properties/cancelled/properties/jobs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                  return false;
                                                                                } else {
                                                                                  if (data150 < 0 || isNaN(data150)) {
                                                                                    validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/cancelled/jobs", schemaPath: "#/properties/wholeJobs/properties/states/properties/cancelled/properties/jobs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                    return false;
                                                                                  }
                                                                                }
                                                                              }
                                                                            }
                                                                            var valid38 = _errs329 === errors2;
                                                                          } else {
                                                                            var valid38 = true;
                                                                          }
                                                                          if (valid38) {
                                                                            if (data149.attempts !== void 0) {
                                                                              let data151 = data149.attempts;
                                                                              const _errs331 = errors2;
                                                                              if (!(typeof data151 == "number" && (!(data151 % 1) && !isNaN(data151)) && isFinite(data151))) {
                                                                                validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/cancelled/attempts", schemaPath: "#/properties/wholeJobs/properties/states/properties/cancelled/properties/attempts/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                return false;
                                                                              }
                                                                              if (errors2 === _errs331) {
                                                                                if (typeof data151 == "number" && isFinite(data151)) {
                                                                                  if (data151 > 9007199254740991 || isNaN(data151)) {
                                                                                    validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/cancelled/attempts", schemaPath: "#/properties/wholeJobs/properties/states/properties/cancelled/properties/attempts/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                    return false;
                                                                                  } else {
                                                                                    if (data151 < 0 || isNaN(data151)) {
                                                                                      validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/cancelled/attempts", schemaPath: "#/properties/wholeJobs/properties/states/properties/cancelled/properties/attempts/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                      return false;
                                                                                    }
                                                                                  }
                                                                                }
                                                                              }
                                                                              var valid38 = _errs331 === errors2;
                                                                            } else {
                                                                              var valid38 = true;
                                                                            }
                                                                            if (valid38) {
                                                                              if (data149.knownChargeMicroUsd !== void 0) {
                                                                                let data152 = data149.knownChargeMicroUsd;
                                                                                const _errs333 = errors2;
                                                                                if (!(typeof data152 == "number" && (!(data152 % 1) && !isNaN(data152)) && isFinite(data152))) {
                                                                                  validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/cancelled/knownChargeMicroUsd", schemaPath: "#/properties/wholeJobs/properties/states/properties/cancelled/properties/knownChargeMicroUsd/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                  return false;
                                                                                }
                                                                                if (errors2 === _errs333) {
                                                                                  if (typeof data152 == "number" && isFinite(data152)) {
                                                                                    if (data152 > 9007199254740991 || isNaN(data152)) {
                                                                                      validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/cancelled/knownChargeMicroUsd", schemaPath: "#/properties/wholeJobs/properties/states/properties/cancelled/properties/knownChargeMicroUsd/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                      return false;
                                                                                    } else {
                                                                                      if (data152 < 0 || isNaN(data152)) {
                                                                                        validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/cancelled/knownChargeMicroUsd", schemaPath: "#/properties/wholeJobs/properties/states/properties/cancelled/properties/knownChargeMicroUsd/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                        return false;
                                                                                      }
                                                                                    }
                                                                                  }
                                                                                }
                                                                                var valid38 = _errs333 === errors2;
                                                                              } else {
                                                                                var valid38 = true;
                                                                              }
                                                                            }
                                                                          }
                                                                        }
                                                                      }
                                                                    } else {
                                                                      validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/cancelled", schemaPath: "#/properties/wholeJobs/properties/states/properties/cancelled/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                                      return false;
                                                                    }
                                                                  }
                                                                  var valid34 = _errs326 === errors2;
                                                                } else {
                                                                  var valid34 = true;
                                                                }
                                                                if (valid34) {
                                                                  if (data136.unclosed !== void 0) {
                                                                    let data153 = data136.unclosed;
                                                                    const _errs335 = errors2;
                                                                    if (errors2 === _errs335) {
                                                                      if (data153 && typeof data153 == "object" && !Array.isArray(data153)) {
                                                                        let missing29;
                                                                        if (data153.jobs === void 0 && (missing29 = "jobs") || data153.attempts === void 0 && (missing29 = "attempts") || data153.knownChargeMicroUsd === void 0 && (missing29 = "knownChargeMicroUsd")) {
                                                                          validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/unclosed", schemaPath: "#/properties/wholeJobs/properties/states/properties/unclosed/required", keyword: "required", params: { missingProperty: missing29 }, message: "must have required property '" + missing29 + "'" }];
                                                                          return false;
                                                                        } else {
                                                                          const _errs337 = errors2;
                                                                          for (const key29 in data153) {
                                                                            if (!(key29 === "jobs" || key29 === "attempts" || key29 === "knownChargeMicroUsd")) {
                                                                              validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/unclosed", schemaPath: "#/properties/wholeJobs/properties/states/properties/unclosed/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key29 }, message: "must NOT have additional properties" }];
                                                                              return false;
                                                                              break;
                                                                            }
                                                                          }
                                                                          if (_errs337 === errors2) {
                                                                            if (data153.jobs !== void 0) {
                                                                              let data154 = data153.jobs;
                                                                              const _errs338 = errors2;
                                                                              if (!(typeof data154 == "number" && (!(data154 % 1) && !isNaN(data154)) && isFinite(data154))) {
                                                                                validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/unclosed/jobs", schemaPath: "#/properties/wholeJobs/properties/states/properties/unclosed/properties/jobs/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                return false;
                                                                              }
                                                                              if (errors2 === _errs338) {
                                                                                if (typeof data154 == "number" && isFinite(data154)) {
                                                                                  if (data154 > 9007199254740991 || isNaN(data154)) {
                                                                                    validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/unclosed/jobs", schemaPath: "#/properties/wholeJobs/properties/states/properties/unclosed/properties/jobs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                    return false;
                                                                                  } else {
                                                                                    if (data154 < 0 || isNaN(data154)) {
                                                                                      validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/unclosed/jobs", schemaPath: "#/properties/wholeJobs/properties/states/properties/unclosed/properties/jobs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                      return false;
                                                                                    }
                                                                                  }
                                                                                }
                                                                              }
                                                                              var valid39 = _errs338 === errors2;
                                                                            } else {
                                                                              var valid39 = true;
                                                                            }
                                                                            if (valid39) {
                                                                              if (data153.attempts !== void 0) {
                                                                                let data155 = data153.attempts;
                                                                                const _errs340 = errors2;
                                                                                if (!(typeof data155 == "number" && (!(data155 % 1) && !isNaN(data155)) && isFinite(data155))) {
                                                                                  validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/unclosed/attempts", schemaPath: "#/properties/wholeJobs/properties/states/properties/unclosed/properties/attempts/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                  return false;
                                                                                }
                                                                                if (errors2 === _errs340) {
                                                                                  if (typeof data155 == "number" && isFinite(data155)) {
                                                                                    if (data155 > 9007199254740991 || isNaN(data155)) {
                                                                                      validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/unclosed/attempts", schemaPath: "#/properties/wholeJobs/properties/states/properties/unclosed/properties/attempts/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                      return false;
                                                                                    } else {
                                                                                      if (data155 < 0 || isNaN(data155)) {
                                                                                        validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/unclosed/attempts", schemaPath: "#/properties/wholeJobs/properties/states/properties/unclosed/properties/attempts/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                        return false;
                                                                                      }
                                                                                    }
                                                                                  }
                                                                                }
                                                                                var valid39 = _errs340 === errors2;
                                                                              } else {
                                                                                var valid39 = true;
                                                                              }
                                                                              if (valid39) {
                                                                                if (data153.knownChargeMicroUsd !== void 0) {
                                                                                  let data156 = data153.knownChargeMicroUsd;
                                                                                  const _errs342 = errors2;
                                                                                  if (!(typeof data156 == "number" && (!(data156 % 1) && !isNaN(data156)) && isFinite(data156))) {
                                                                                    validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/unclosed/knownChargeMicroUsd", schemaPath: "#/properties/wholeJobs/properties/states/properties/unclosed/properties/knownChargeMicroUsd/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                    return false;
                                                                                  }
                                                                                  if (errors2 === _errs342) {
                                                                                    if (typeof data156 == "number" && isFinite(data156)) {
                                                                                      if (data156 > 9007199254740991 || isNaN(data156)) {
                                                                                        validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/unclosed/knownChargeMicroUsd", schemaPath: "#/properties/wholeJobs/properties/states/properties/unclosed/properties/knownChargeMicroUsd/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                        return false;
                                                                                      } else {
                                                                                        if (data156 < 0 || isNaN(data156)) {
                                                                                          validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/unclosed/knownChargeMicroUsd", schemaPath: "#/properties/wholeJobs/properties/states/properties/unclosed/properties/knownChargeMicroUsd/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                          return false;
                                                                                        }
                                                                                      }
                                                                                    }
                                                                                  }
                                                                                  var valid39 = _errs342 === errors2;
                                                                                } else {
                                                                                  var valid39 = true;
                                                                                }
                                                                              }
                                                                            }
                                                                          }
                                                                        }
                                                                      } else {
                                                                        validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states/unclosed", schemaPath: "#/properties/wholeJobs/properties/states/properties/unclosed/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                                        return false;
                                                                      }
                                                                    }
                                                                    var valid34 = _errs335 === errors2;
                                                                  } else {
                                                                    var valid34 = true;
                                                                  }
                                                                }
                                                              }
                                                            }
                                                          }
                                                        }
                                                      }
                                                    } else {
                                                      validate29.errors = [{ instancePath: instancePath + "/wholeJobs/states", schemaPath: "#/properties/wholeJobs/properties/states/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                      return false;
                                                    }
                                                  }
                                                  var valid33 = _errs296 === errors2;
                                                } else {
                                                  var valid33 = true;
                                                }
                                                if (valid33) {
                                                  if (data133.jobs !== void 0) {
                                                    let data157 = data133.jobs;
                                                    const _errs344 = errors2;
                                                    if (!(typeof data157 == "number" && (!(data157 % 1) && !isNaN(data157)) && isFinite(data157))) {
                                                      validate29.errors = [{ instancePath: instancePath + "/wholeJobs/jobs", schemaPath: "#/properties/wholeJobs/properties/jobs/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                      return false;
                                                    }
                                                    if (errors2 === _errs344) {
                                                      if (typeof data157 == "number" && isFinite(data157)) {
                                                        if (data157 > 9007199254740991 || isNaN(data157)) {
                                                          validate29.errors = [{ instancePath: instancePath + "/wholeJobs/jobs", schemaPath: "#/properties/wholeJobs/properties/jobs/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                          return false;
                                                        } else {
                                                          if (data157 < 0 || isNaN(data157)) {
                                                            validate29.errors = [{ instancePath: instancePath + "/wholeJobs/jobs", schemaPath: "#/properties/wholeJobs/properties/jobs/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                            return false;
                                                          }
                                                        }
                                                      }
                                                    }
                                                    var valid33 = _errs344 === errors2;
                                                  } else {
                                                    var valid33 = true;
                                                  }
                                                  if (valid33) {
                                                    if (data133.attempts !== void 0) {
                                                      let data158 = data133.attempts;
                                                      const _errs346 = errors2;
                                                      if (!(typeof data158 == "number" && (!(data158 % 1) && !isNaN(data158)) && isFinite(data158))) {
                                                        validate29.errors = [{ instancePath: instancePath + "/wholeJobs/attempts", schemaPath: "#/properties/wholeJobs/properties/attempts/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                        return false;
                                                      }
                                                      if (errors2 === _errs346) {
                                                        if (typeof data158 == "number" && isFinite(data158)) {
                                                          if (data158 > 9007199254740991 || isNaN(data158)) {
                                                            validate29.errors = [{ instancePath: instancePath + "/wholeJobs/attempts", schemaPath: "#/properties/wholeJobs/properties/attempts/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                            return false;
                                                          } else {
                                                            if (data158 < 0 || isNaN(data158)) {
                                                              validate29.errors = [{ instancePath: instancePath + "/wholeJobs/attempts", schemaPath: "#/properties/wholeJobs/properties/attempts/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                              return false;
                                                            }
                                                          }
                                                        }
                                                      }
                                                      var valid33 = _errs346 === errors2;
                                                    } else {
                                                      var valid33 = true;
                                                    }
                                                    if (valid33) {
                                                      if (data133.revisions !== void 0) {
                                                        let data159 = data133.revisions;
                                                        const _errs348 = errors2;
                                                        if (!(typeof data159 == "number" && (!(data159 % 1) && !isNaN(data159)) && isFinite(data159))) {
                                                          validate29.errors = [{ instancePath: instancePath + "/wholeJobs/revisions", schemaPath: "#/properties/wholeJobs/properties/revisions/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                          return false;
                                                        }
                                                        if (errors2 === _errs348) {
                                                          if (typeof data159 == "number" && isFinite(data159)) {
                                                            if (data159 > 9007199254740991 || isNaN(data159)) {
                                                              validate29.errors = [{ instancePath: instancePath + "/wholeJobs/revisions", schemaPath: "#/properties/wholeJobs/properties/revisions/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                              return false;
                                                            } else {
                                                              if (data159 < 0 || isNaN(data159)) {
                                                                validate29.errors = [{ instancePath: instancePath + "/wholeJobs/revisions", schemaPath: "#/properties/wholeJobs/properties/revisions/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                return false;
                                                              }
                                                            }
                                                          }
                                                        }
                                                        var valid33 = _errs348 === errors2;
                                                      } else {
                                                        var valid33 = true;
                                                      }
                                                      if (valid33) {
                                                        if (data133.steerRevisions !== void 0) {
                                                          let data160 = data133.steerRevisions;
                                                          const _errs350 = errors2;
                                                          if (!(typeof data160 == "number" && (!(data160 % 1) && !isNaN(data160)) && isFinite(data160))) {
                                                            validate29.errors = [{ instancePath: instancePath + "/wholeJobs/steerRevisions", schemaPath: "#/properties/wholeJobs/properties/steerRevisions/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                            return false;
                                                          }
                                                          if (errors2 === _errs350) {
                                                            if (typeof data160 == "number" && isFinite(data160)) {
                                                              if (data160 > 9007199254740991 || isNaN(data160)) {
                                                                validate29.errors = [{ instancePath: instancePath + "/wholeJobs/steerRevisions", schemaPath: "#/properties/wholeJobs/properties/steerRevisions/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                return false;
                                                              } else {
                                                                if (data160 < 0 || isNaN(data160)) {
                                                                  validate29.errors = [{ instancePath: instancePath + "/wholeJobs/steerRevisions", schemaPath: "#/properties/wholeJobs/properties/steerRevisions/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                  return false;
                                                                }
                                                              }
                                                            }
                                                          }
                                                          var valid33 = _errs350 === errors2;
                                                        } else {
                                                          var valid33 = true;
                                                        }
                                                        if (valid33) {
                                                          if (data133.tails !== void 0) {
                                                            let data161 = data133.tails;
                                                            const _errs352 = errors2;
                                                            if (!(typeof data161 == "number" && (!(data161 % 1) && !isNaN(data161)) && isFinite(data161))) {
                                                              validate29.errors = [{ instancePath: instancePath + "/wholeJobs/tails", schemaPath: "#/properties/wholeJobs/properties/tails/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                              return false;
                                                            }
                                                            if (errors2 === _errs352) {
                                                              if (typeof data161 == "number" && isFinite(data161)) {
                                                                if (data161 > 9007199254740991 || isNaN(data161)) {
                                                                  validate29.errors = [{ instancePath: instancePath + "/wholeJobs/tails", schemaPath: "#/properties/wholeJobs/properties/tails/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                  return false;
                                                                } else {
                                                                  if (data161 < 0 || isNaN(data161)) {
                                                                    validate29.errors = [{ instancePath: instancePath + "/wholeJobs/tails", schemaPath: "#/properties/wholeJobs/properties/tails/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                    return false;
                                                                  }
                                                                }
                                                              }
                                                            }
                                                            var valid33 = _errs352 === errors2;
                                                          } else {
                                                            var valid33 = true;
                                                          }
                                                          if (valid33) {
                                                            if (data133.settledRevisions !== void 0) {
                                                              let data162 = data133.settledRevisions;
                                                              const _errs354 = errors2;
                                                              if (!(typeof data162 == "number" && (!(data162 % 1) && !isNaN(data162)) && isFinite(data162))) {
                                                                validate29.errors = [{ instancePath: instancePath + "/wholeJobs/settledRevisions", schemaPath: "#/properties/wholeJobs/properties/settledRevisions/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                return false;
                                                              }
                                                              if (errors2 === _errs354) {
                                                                if (typeof data162 == "number" && isFinite(data162)) {
                                                                  if (data162 > 9007199254740991 || isNaN(data162)) {
                                                                    validate29.errors = [{ instancePath: instancePath + "/wholeJobs/settledRevisions", schemaPath: "#/properties/wholeJobs/properties/settledRevisions/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                    return false;
                                                                  } else {
                                                                    if (data162 < 0 || isNaN(data162)) {
                                                                      validate29.errors = [{ instancePath: instancePath + "/wholeJobs/settledRevisions", schemaPath: "#/properties/wholeJobs/properties/settledRevisions/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                      return false;
                                                                    }
                                                                  }
                                                                }
                                                              }
                                                              var valid33 = _errs354 === errors2;
                                                            } else {
                                                              var valid33 = true;
                                                            }
                                                            if (valid33) {
                                                              if (data133.closurePending !== void 0) {
                                                                let data163 = data133.closurePending;
                                                                const _errs356 = errors2;
                                                                if (!(typeof data163 == "number" && (!(data163 % 1) && !isNaN(data163)) && isFinite(data163))) {
                                                                  validate29.errors = [{ instancePath: instancePath + "/wholeJobs/closurePending", schemaPath: "#/properties/wholeJobs/properties/closurePending/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                  return false;
                                                                }
                                                                if (errors2 === _errs356) {
                                                                  if (typeof data163 == "number" && isFinite(data163)) {
                                                                    if (data163 > 9007199254740991 || isNaN(data163)) {
                                                                      validate29.errors = [{ instancePath: instancePath + "/wholeJobs/closurePending", schemaPath: "#/properties/wholeJobs/properties/closurePending/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                      return false;
                                                                    } else {
                                                                      if (data163 < 0 || isNaN(data163)) {
                                                                        validate29.errors = [{ instancePath: instancePath + "/wholeJobs/closurePending", schemaPath: "#/properties/wholeJobs/properties/closurePending/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                        return false;
                                                                      }
                                                                    }
                                                                  }
                                                                }
                                                                var valid33 = _errs356 === errors2;
                                                              } else {
                                                                var valid33 = true;
                                                              }
                                                              if (valid33) {
                                                                if (data133.unresolvedSuccessors !== void 0) {
                                                                  let data164 = data133.unresolvedSuccessors;
                                                                  const _errs358 = errors2;
                                                                  if (!(typeof data164 == "number" && (!(data164 % 1) && !isNaN(data164)) && isFinite(data164))) {
                                                                    validate29.errors = [{ instancePath: instancePath + "/wholeJobs/unresolvedSuccessors", schemaPath: "#/properties/wholeJobs/properties/unresolvedSuccessors/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                    return false;
                                                                  }
                                                                  if (errors2 === _errs358) {
                                                                    if (typeof data164 == "number" && isFinite(data164)) {
                                                                      if (data164 > 9007199254740991 || isNaN(data164)) {
                                                                        validate29.errors = [{ instancePath: instancePath + "/wholeJobs/unresolvedSuccessors", schemaPath: "#/properties/wholeJobs/properties/unresolvedSuccessors/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                        return false;
                                                                      } else {
                                                                        if (data164 < 0 || isNaN(data164)) {
                                                                          validate29.errors = [{ instancePath: instancePath + "/wholeJobs/unresolvedSuccessors", schemaPath: "#/properties/wholeJobs/properties/unresolvedSuccessors/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                          return false;
                                                                        }
                                                                      }
                                                                    }
                                                                  }
                                                                  var valid33 = _errs358 === errors2;
                                                                } else {
                                                                  var valid33 = true;
                                                                }
                                                                if (valid33) {
                                                                  if (data133.unsettledChildren !== void 0) {
                                                                    let data165 = data133.unsettledChildren;
                                                                    const _errs360 = errors2;
                                                                    if (!(typeof data165 == "number" && (!(data165 % 1) && !isNaN(data165)) && isFinite(data165))) {
                                                                      validate29.errors = [{ instancePath: instancePath + "/wholeJobs/unsettledChildren", schemaPath: "#/properties/wholeJobs/properties/unsettledChildren/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                      return false;
                                                                    }
                                                                    if (errors2 === _errs360) {
                                                                      if (typeof data165 == "number" && isFinite(data165)) {
                                                                        if (data165 > 9007199254740991 || isNaN(data165)) {
                                                                          validate29.errors = [{ instancePath: instancePath + "/wholeJobs/unsettledChildren", schemaPath: "#/properties/wholeJobs/properties/unsettledChildren/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                          return false;
                                                                        } else {
                                                                          if (data165 < 0 || isNaN(data165)) {
                                                                            validate29.errors = [{ instancePath: instancePath + "/wholeJobs/unsettledChildren", schemaPath: "#/properties/wholeJobs/properties/unsettledChildren/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                            return false;
                                                                          }
                                                                        }
                                                                      }
                                                                    }
                                                                    var valid33 = _errs360 === errors2;
                                                                  } else {
                                                                    var valid33 = true;
                                                                  }
                                                                  if (valid33) {
                                                                    if (data133.knownChargeMicroUsd !== void 0) {
                                                                      let data166 = data133.knownChargeMicroUsd;
                                                                      const _errs362 = errors2;
                                                                      if (!(typeof data166 == "number" && (!(data166 % 1) && !isNaN(data166)) && isFinite(data166))) {
                                                                        validate29.errors = [{ instancePath: instancePath + "/wholeJobs/knownChargeMicroUsd", schemaPath: "#/properties/wholeJobs/properties/knownChargeMicroUsd/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                        return false;
                                                                      }
                                                                      if (errors2 === _errs362) {
                                                                        if (typeof data166 == "number" && isFinite(data166)) {
                                                                          if (data166 > 9007199254740991 || isNaN(data166)) {
                                                                            validate29.errors = [{ instancePath: instancePath + "/wholeJobs/knownChargeMicroUsd", schemaPath: "#/properties/wholeJobs/properties/knownChargeMicroUsd/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                            return false;
                                                                          } else {
                                                                            if (data166 < 0 || isNaN(data166)) {
                                                                              validate29.errors = [{ instancePath: instancePath + "/wholeJobs/knownChargeMicroUsd", schemaPath: "#/properties/wholeJobs/properties/knownChargeMicroUsd/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                              return false;
                                                                            }
                                                                          }
                                                                        }
                                                                      }
                                                                      var valid33 = _errs362 === errors2;
                                                                    } else {
                                                                      var valid33 = true;
                                                                    }
                                                                    if (valid33) {
                                                                      if (data133.microUsdPerSuccessfulJob !== void 0) {
                                                                        let data167 = data133.microUsdPerSuccessfulJob;
                                                                        const _errs364 = errors2;
                                                                        const _errs365 = errors2;
                                                                        let valid40 = false;
                                                                        const _errs366 = errors2;
                                                                        if (errors2 === _errs366) {
                                                                          if (typeof data167 == "number" && isFinite(data167)) {
                                                                            if (data167 > 9007199254740992e-6 || isNaN(data167)) {
                                                                              const err58 = { instancePath: instancePath + "/wholeJobs/microUsdPerSuccessfulJob", schemaPath: "#/properties/wholeJobs/properties/microUsdPerSuccessfulJob/anyOf/0/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740992e-6 }, message: "must be <= 9007199254.740992" };
                                                                              if (vErrors === null) {
                                                                                vErrors = [err58];
                                                                              } else {
                                                                                vErrors.push(err58);
                                                                              }
                                                                              errors2++;
                                                                            } else {
                                                                              if (data167 < 0 || isNaN(data167)) {
                                                                                const err59 = { instancePath: instancePath + "/wholeJobs/microUsdPerSuccessfulJob", schemaPath: "#/properties/wholeJobs/properties/microUsdPerSuccessfulJob/anyOf/0/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                                                                if (vErrors === null) {
                                                                                  vErrors = [err59];
                                                                                } else {
                                                                                  vErrors.push(err59);
                                                                                }
                                                                                errors2++;
                                                                              }
                                                                            }
                                                                          } else {
                                                                            const err60 = { instancePath: instancePath + "/wholeJobs/microUsdPerSuccessfulJob", schemaPath: "#/properties/wholeJobs/properties/microUsdPerSuccessfulJob/anyOf/0/type", keyword: "type", params: { type: "number" }, message: "must be number" };
                                                                            if (vErrors === null) {
                                                                              vErrors = [err60];
                                                                            } else {
                                                                              vErrors.push(err60);
                                                                            }
                                                                            errors2++;
                                                                          }
                                                                        }
                                                                        var _valid8 = _errs366 === errors2;
                                                                        valid40 = valid40 || _valid8;
                                                                        const _errs368 = errors2;
                                                                        if (data167 !== null) {
                                                                          const err61 = { instancePath: instancePath + "/wholeJobs/microUsdPerSuccessfulJob", schemaPath: "#/properties/wholeJobs/properties/microUsdPerSuccessfulJob/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                                                          if (vErrors === null) {
                                                                            vErrors = [err61];
                                                                          } else {
                                                                            vErrors.push(err61);
                                                                          }
                                                                          errors2++;
                                                                        }
                                                                        var _valid8 = _errs368 === errors2;
                                                                        valid40 = valid40 || _valid8;
                                                                        if (!valid40) {
                                                                          const err62 = { instancePath: instancePath + "/wholeJobs/microUsdPerSuccessfulJob", schemaPath: "#/properties/wholeJobs/properties/microUsdPerSuccessfulJob/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                                                          if (vErrors === null) {
                                                                            vErrors = [err62];
                                                                          } else {
                                                                            vErrors.push(err62);
                                                                          }
                                                                          errors2++;
                                                                          validate29.errors = vErrors;
                                                                          return false;
                                                                        } else {
                                                                          errors2 = _errs365;
                                                                          if (vErrors !== null) {
                                                                            if (_errs365) {
                                                                              vErrors.length = _errs365;
                                                                            } else {
                                                                              vErrors = null;
                                                                            }
                                                                          }
                                                                        }
                                                                        var valid33 = _errs364 === errors2;
                                                                      } else {
                                                                        var valid33 = true;
                                                                      }
                                                                      if (valid33) {
                                                                        if (data133.coverage !== void 0) {
                                                                          let data168 = data133.coverage;
                                                                          const _errs370 = errors2;
                                                                          if (errors2 === _errs370) {
                                                                            if (data168 && typeof data168 == "object" && !Array.isArray(data168)) {
                                                                              let missing30;
                                                                              if (data168.jobsWithRecordedUsage === void 0 && (missing30 = "jobsWithRecordedUsage") || data168.jobsWithUnavailableUsage === void 0 && (missing30 = "jobsWithUnavailableUsage") || data168.revisionsWithRootOutsideWindow === void 0 && (missing30 = "revisionsWithRootOutsideWindow") || data168.chargeAttribution === void 0 && (missing30 = "chargeAttribution") || data168.windowEdge === void 0 && (missing30 = "windowEdge") || data168.providerBilledMicroUsd === void 0 && (missing30 = "providerBilledMicroUsd") || data168.completeJobCost === void 0 && (missing30 = "completeJobCost")) {
                                                                                validate29.errors = [{ instancePath: instancePath + "/wholeJobs/coverage", schemaPath: "#/properties/wholeJobs/properties/coverage/required", keyword: "required", params: { missingProperty: missing30 }, message: "must have required property '" + missing30 + "'" }];
                                                                                return false;
                                                                              } else {
                                                                                const _errs372 = errors2;
                                                                                for (const key30 in data168) {
                                                                                  if (!(key30 === "jobsWithRecordedUsage" || key30 === "jobsWithUnavailableUsage" || key30 === "revisionsWithRootOutsideWindow" || key30 === "chargeAttribution" || key30 === "windowEdge" || key30 === "providerBilledMicroUsd" || key30 === "completeJobCost")) {
                                                                                    validate29.errors = [{ instancePath: instancePath + "/wholeJobs/coverage", schemaPath: "#/properties/wholeJobs/properties/coverage/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key30 }, message: "must NOT have additional properties" }];
                                                                                    return false;
                                                                                    break;
                                                                                  }
                                                                                }
                                                                                if (_errs372 === errors2) {
                                                                                  if (data168.jobsWithRecordedUsage !== void 0) {
                                                                                    let data169 = data168.jobsWithRecordedUsage;
                                                                                    const _errs373 = errors2;
                                                                                    if (!(typeof data169 == "number" && (!(data169 % 1) && !isNaN(data169)) && isFinite(data169))) {
                                                                                      validate29.errors = [{ instancePath: instancePath + "/wholeJobs/coverage/jobsWithRecordedUsage", schemaPath: "#/properties/wholeJobs/properties/coverage/properties/jobsWithRecordedUsage/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                      return false;
                                                                                    }
                                                                                    if (errors2 === _errs373) {
                                                                                      if (typeof data169 == "number" && isFinite(data169)) {
                                                                                        if (data169 > 9007199254740991 || isNaN(data169)) {
                                                                                          validate29.errors = [{ instancePath: instancePath + "/wholeJobs/coverage/jobsWithRecordedUsage", schemaPath: "#/properties/wholeJobs/properties/coverage/properties/jobsWithRecordedUsage/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                          return false;
                                                                                        } else {
                                                                                          if (data169 < 0 || isNaN(data169)) {
                                                                                            validate29.errors = [{ instancePath: instancePath + "/wholeJobs/coverage/jobsWithRecordedUsage", schemaPath: "#/properties/wholeJobs/properties/coverage/properties/jobsWithRecordedUsage/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                            return false;
                                                                                          }
                                                                                        }
                                                                                      }
                                                                                    }
                                                                                    var valid41 = _errs373 === errors2;
                                                                                  } else {
                                                                                    var valid41 = true;
                                                                                  }
                                                                                  if (valid41) {
                                                                                    if (data168.jobsWithUnavailableUsage !== void 0) {
                                                                                      let data170 = data168.jobsWithUnavailableUsage;
                                                                                      const _errs375 = errors2;
                                                                                      if (!(typeof data170 == "number" && (!(data170 % 1) && !isNaN(data170)) && isFinite(data170))) {
                                                                                        validate29.errors = [{ instancePath: instancePath + "/wholeJobs/coverage/jobsWithUnavailableUsage", schemaPath: "#/properties/wholeJobs/properties/coverage/properties/jobsWithUnavailableUsage/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                        return false;
                                                                                      }
                                                                                      if (errors2 === _errs375) {
                                                                                        if (typeof data170 == "number" && isFinite(data170)) {
                                                                                          if (data170 > 9007199254740991 || isNaN(data170)) {
                                                                                            validate29.errors = [{ instancePath: instancePath + "/wholeJobs/coverage/jobsWithUnavailableUsage", schemaPath: "#/properties/wholeJobs/properties/coverage/properties/jobsWithUnavailableUsage/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                            return false;
                                                                                          } else {
                                                                                            if (data170 < 0 || isNaN(data170)) {
                                                                                              validate29.errors = [{ instancePath: instancePath + "/wholeJobs/coverage/jobsWithUnavailableUsage", schemaPath: "#/properties/wholeJobs/properties/coverage/properties/jobsWithUnavailableUsage/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                              return false;
                                                                                            }
                                                                                          }
                                                                                        }
                                                                                      }
                                                                                      var valid41 = _errs375 === errors2;
                                                                                    } else {
                                                                                      var valid41 = true;
                                                                                    }
                                                                                    if (valid41) {
                                                                                      if (data168.revisionsWithRootOutsideWindow !== void 0) {
                                                                                        let data171 = data168.revisionsWithRootOutsideWindow;
                                                                                        const _errs377 = errors2;
                                                                                        if (!(typeof data171 == "number" && (!(data171 % 1) && !isNaN(data171)) && isFinite(data171))) {
                                                                                          validate29.errors = [{ instancePath: instancePath + "/wholeJobs/coverage/revisionsWithRootOutsideWindow", schemaPath: "#/properties/wholeJobs/properties/coverage/properties/revisionsWithRootOutsideWindow/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                          return false;
                                                                                        }
                                                                                        if (errors2 === _errs377) {
                                                                                          if (typeof data171 == "number" && isFinite(data171)) {
                                                                                            if (data171 > 9007199254740991 || isNaN(data171)) {
                                                                                              validate29.errors = [{ instancePath: instancePath + "/wholeJobs/coverage/revisionsWithRootOutsideWindow", schemaPath: "#/properties/wholeJobs/properties/coverage/properties/revisionsWithRootOutsideWindow/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                              return false;
                                                                                            } else {
                                                                                              if (data171 < 0 || isNaN(data171)) {
                                                                                                validate29.errors = [{ instancePath: instancePath + "/wholeJobs/coverage/revisionsWithRootOutsideWindow", schemaPath: "#/properties/wholeJobs/properties/coverage/properties/revisionsWithRootOutsideWindow/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                                return false;
                                                                                              }
                                                                                            }
                                                                                          }
                                                                                        }
                                                                                        var valid41 = _errs377 === errors2;
                                                                                      } else {
                                                                                        var valid41 = true;
                                                                                      }
                                                                                      if (valid41) {
                                                                                        if (data168.chargeAttribution !== void 0) {
                                                                                          const _errs379 = errors2;
                                                                                          if ("whole-job-lineage-at-root-revision-window" !== data168.chargeAttribution) {
                                                                                            validate29.errors = [{ instancePath: instancePath + "/wholeJobs/coverage/chargeAttribution", schemaPath: "#/properties/wholeJobs/properties/coverage/properties/chargeAttribution/const", keyword: "const", params: { allowedValue: "whole-job-lineage-at-root-revision-window" }, message: "must be equal to constant" }];
                                                                                            return false;
                                                                                          }
                                                                                          var valid41 = _errs379 === errors2;
                                                                                        } else {
                                                                                          var valid41 = true;
                                                                                        }
                                                                                        if (valid41) {
                                                                                          if (data168.windowEdge !== void 0) {
                                                                                            const _errs380 = errors2;
                                                                                            if ("a revision created after the window is not read, so a job whose continuation falls outside the window is reported from the revisions inside it only, and a continuation whose root revision is outside the window is excluded and counted" !== data168.windowEdge) {
                                                                                              validate29.errors = [{ instancePath: instancePath + "/wholeJobs/coverage/windowEdge", schemaPath: "#/properties/wholeJobs/properties/coverage/properties/windowEdge/const", keyword: "const", params: { allowedValue: "a revision created after the window is not read, so a job whose continuation falls outside the window is reported from the revisions inside it only, and a continuation whose root revision is outside the window is excluded and counted" }, message: "must be equal to constant" }];
                                                                                              return false;
                                                                                            }
                                                                                            var valid41 = _errs380 === errors2;
                                                                                          } else {
                                                                                            var valid41 = true;
                                                                                          }
                                                                                          if (valid41) {
                                                                                            if (data168.providerBilledMicroUsd !== void 0) {
                                                                                              const _errs381 = errors2;
                                                                                              if (data168.providerBilledMicroUsd !== null) {
                                                                                                validate29.errors = [{ instancePath: instancePath + "/wholeJobs/coverage/providerBilledMicroUsd", schemaPath: "#/properties/wholeJobs/properties/coverage/properties/providerBilledMicroUsd/type", keyword: "type", params: { type: "null" }, message: "must be null" }];
                                                                                                return false;
                                                                                              }
                                                                                              var valid41 = _errs381 === errors2;
                                                                                            } else {
                                                                                              var valid41 = true;
                                                                                            }
                                                                                            if (valid41) {
                                                                                              if (data168.completeJobCost !== void 0) {
                                                                                                const _errs383 = errors2;
                                                                                                if ("estimated" !== data168.completeJobCost) {
                                                                                                  validate29.errors = [{ instancePath: instancePath + "/wholeJobs/coverage/completeJobCost", schemaPath: "#/properties/wholeJobs/properties/coverage/properties/completeJobCost/const", keyword: "const", params: { allowedValue: "estimated" }, message: "must be equal to constant" }];
                                                                                                  return false;
                                                                                                }
                                                                                                var valid41 = _errs383 === errors2;
                                                                                              } else {
                                                                                                var valid41 = true;
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
                                                                              validate29.errors = [{ instancePath: instancePath + "/wholeJobs/coverage", schemaPath: "#/properties/wholeJobs/properties/coverage/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                                              return false;
                                                                            }
                                                                          }
                                                                          var valid33 = _errs370 === errors2;
                                                                        } else {
                                                                          var valid33 = true;
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
                                          }
                                        }
                                      } else {
                                        validate29.errors = [{ instancePath: instancePath + "/wholeJobs", schemaPath: "#/properties/wholeJobs/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                        return false;
                                      }
                                    }
                                    var valid0 = _errs291 === errors2;
                                  } else {
                                    var valid0 = true;
                                  }
                                  if (valid0) {
                                    if (data.categories !== void 0) {
                                      let data176 = data.categories;
                                      const _errs384 = errors2;
                                      if (errors2 === _errs384) {
                                        if (data176 && typeof data176 == "object" && !Array.isArray(data176)) {
                                          let missing31;
                                          if (data176.inputTokens === void 0 && (missing31 = "inputTokens") || data176.outputTokens === void 0 && (missing31 = "outputTokens") || data176.reasoningTokens === void 0 && (missing31 = "reasoningTokens") || data176.cacheReadInputTokens === void 0 && (missing31 = "cacheReadInputTokens") || data176.cacheCreationInputTokens === void 0 && (missing31 = "cacheCreationInputTokens") || data176.webSearchRequests === void 0 && (missing31 = "webSearchRequests") || data176.toolInvocations === void 0 && (missing31 = "toolInvocations") || data176.toolOutcomes === void 0 && (missing31 = "toolOutcomes") || data176.cost === void 0 && (missing31 = "cost") || data176.providerBilledMicroUsd === void 0 && (missing31 = "providerBilledMicroUsd") || data176.subagentCost === void 0 && (missing31 = "subagentCost") || data176.compactionCost === void 0 && (missing31 = "compactionCost") || data176.verificationCost === void 0 && (missing31 = "verificationCost") || data176.infrastructureCost === void 0 && (missing31 = "infrastructureCost") || data176.retryCost === void 0 && (missing31 = "retryCost") || data176.fallbackCost === void 0 && (missing31 = "fallbackCost") || data176.extractionCost === void 0 && (missing31 = "extractionCost") || data176.activityCapacity === void 0 && (missing31 = "activityCapacity")) {
                                            validate29.errors = [{ instancePath: instancePath + "/categories", schemaPath: "#/properties/categories/required", keyword: "required", params: { missingProperty: missing31 }, message: "must have required property '" + missing31 + "'" }];
                                            return false;
                                          } else {
                                            const _errs386 = errors2;
                                            for (const key31 in data176) {
                                              if (!func1.call(schema40.properties.categories.properties, key31)) {
                                                validate29.errors = [{ instancePath: instancePath + "/categories", schemaPath: "#/properties/categories/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key31 }, message: "must NOT have additional properties" }];
                                                return false;
                                                break;
                                              }
                                            }
                                            if (_errs386 === errors2) {
                                              if (data176.inputTokens !== void 0) {
                                                let data177 = data176.inputTokens;
                                                const _errs387 = errors2;
                                                if (!(data177 === "measured" || data177 === "estimated" || data177 === "inside-another-counter" || data177 === "unresolved" || data177 === "unavailable")) {
                                                  validate29.errors = [{ instancePath: instancePath + "/categories/inputTokens", schemaPath: "#/properties/categories/properties/inputTokens/enum", keyword: "enum", params: { allowedValues: schema40.properties.categories.properties.inputTokens.enum }, message: "must be equal to one of the allowed values" }];
                                                  return false;
                                                }
                                                var valid42 = _errs387 === errors2;
                                              } else {
                                                var valid42 = true;
                                              }
                                              if (valid42) {
                                                if (data176.outputTokens !== void 0) {
                                                  let data178 = data176.outputTokens;
                                                  const _errs388 = errors2;
                                                  if (!(data178 === "measured" || data178 === "estimated" || data178 === "inside-another-counter" || data178 === "unresolved" || data178 === "unavailable")) {
                                                    validate29.errors = [{ instancePath: instancePath + "/categories/outputTokens", schemaPath: "#/properties/categories/properties/outputTokens/enum", keyword: "enum", params: { allowedValues: schema40.properties.categories.properties.outputTokens.enum }, message: "must be equal to one of the allowed values" }];
                                                    return false;
                                                  }
                                                  var valid42 = _errs388 === errors2;
                                                } else {
                                                  var valid42 = true;
                                                }
                                                if (valid42) {
                                                  if (data176.reasoningTokens !== void 0) {
                                                    let data179 = data176.reasoningTokens;
                                                    const _errs389 = errors2;
                                                    if (!(data179 === "measured" || data179 === "estimated" || data179 === "inside-another-counter" || data179 === "unresolved" || data179 === "unavailable")) {
                                                      validate29.errors = [{ instancePath: instancePath + "/categories/reasoningTokens", schemaPath: "#/properties/categories/properties/reasoningTokens/enum", keyword: "enum", params: { allowedValues: schema40.properties.categories.properties.reasoningTokens.enum }, message: "must be equal to one of the allowed values" }];
                                                      return false;
                                                    }
                                                    var valid42 = _errs389 === errors2;
                                                  } else {
                                                    var valid42 = true;
                                                  }
                                                  if (valid42) {
                                                    if (data176.cacheReadInputTokens !== void 0) {
                                                      let data180 = data176.cacheReadInputTokens;
                                                      const _errs390 = errors2;
                                                      if (!(data180 === "measured" || data180 === "estimated" || data180 === "inside-another-counter" || data180 === "unresolved" || data180 === "unavailable")) {
                                                        validate29.errors = [{ instancePath: instancePath + "/categories/cacheReadInputTokens", schemaPath: "#/properties/categories/properties/cacheReadInputTokens/enum", keyword: "enum", params: { allowedValues: schema40.properties.categories.properties.cacheReadInputTokens.enum }, message: "must be equal to one of the allowed values" }];
                                                        return false;
                                                      }
                                                      var valid42 = _errs390 === errors2;
                                                    } else {
                                                      var valid42 = true;
                                                    }
                                                    if (valid42) {
                                                      if (data176.cacheCreationInputTokens !== void 0) {
                                                        let data181 = data176.cacheCreationInputTokens;
                                                        const _errs391 = errors2;
                                                        if (!(data181 === "measured" || data181 === "estimated" || data181 === "inside-another-counter" || data181 === "unresolved" || data181 === "unavailable")) {
                                                          validate29.errors = [{ instancePath: instancePath + "/categories/cacheCreationInputTokens", schemaPath: "#/properties/categories/properties/cacheCreationInputTokens/enum", keyword: "enum", params: { allowedValues: schema40.properties.categories.properties.cacheCreationInputTokens.enum }, message: "must be equal to one of the allowed values" }];
                                                          return false;
                                                        }
                                                        var valid42 = _errs391 === errors2;
                                                      } else {
                                                        var valid42 = true;
                                                      }
                                                      if (valid42) {
                                                        if (data176.webSearchRequests !== void 0) {
                                                          let data182 = data176.webSearchRequests;
                                                          const _errs392 = errors2;
                                                          if (!(data182 === "measured" || data182 === "estimated" || data182 === "inside-another-counter" || data182 === "unresolved" || data182 === "unavailable")) {
                                                            validate29.errors = [{ instancePath: instancePath + "/categories/webSearchRequests", schemaPath: "#/properties/categories/properties/webSearchRequests/enum", keyword: "enum", params: { allowedValues: schema40.properties.categories.properties.webSearchRequests.enum }, message: "must be equal to one of the allowed values" }];
                                                            return false;
                                                          }
                                                          var valid42 = _errs392 === errors2;
                                                        } else {
                                                          var valid42 = true;
                                                        }
                                                        if (valid42) {
                                                          if (data176.toolInvocations !== void 0) {
                                                            let data183 = data176.toolInvocations;
                                                            const _errs393 = errors2;
                                                            if (!(data183 === "measured" || data183 === "estimated" || data183 === "inside-another-counter" || data183 === "unresolved" || data183 === "unavailable")) {
                                                              validate29.errors = [{ instancePath: instancePath + "/categories/toolInvocations", schemaPath: "#/properties/categories/properties/toolInvocations/enum", keyword: "enum", params: { allowedValues: schema40.properties.categories.properties.toolInvocations.enum }, message: "must be equal to one of the allowed values" }];
                                                              return false;
                                                            }
                                                            var valid42 = _errs393 === errors2;
                                                          } else {
                                                            var valid42 = true;
                                                          }
                                                          if (valid42) {
                                                            if (data176.toolOutcomes !== void 0) {
                                                              let data184 = data176.toolOutcomes;
                                                              const _errs394 = errors2;
                                                              if (!(data184 === "measured" || data184 === "estimated" || data184 === "inside-another-counter" || data184 === "unresolved" || data184 === "unavailable")) {
                                                                validate29.errors = [{ instancePath: instancePath + "/categories/toolOutcomes", schemaPath: "#/properties/categories/properties/toolOutcomes/enum", keyword: "enum", params: { allowedValues: schema40.properties.categories.properties.toolOutcomes.enum }, message: "must be equal to one of the allowed values" }];
                                                                return false;
                                                              }
                                                              var valid42 = _errs394 === errors2;
                                                            } else {
                                                              var valid42 = true;
                                                            }
                                                            if (valid42) {
                                                              if (data176.cost !== void 0) {
                                                                let data185 = data176.cost;
                                                                const _errs395 = errors2;
                                                                if (!(data185 === "measured" || data185 === "estimated" || data185 === "inside-another-counter" || data185 === "unresolved" || data185 === "unavailable")) {
                                                                  validate29.errors = [{ instancePath: instancePath + "/categories/cost", schemaPath: "#/properties/categories/properties/cost/enum", keyword: "enum", params: { allowedValues: schema40.properties.categories.properties.cost.enum }, message: "must be equal to one of the allowed values" }];
                                                                  return false;
                                                                }
                                                                var valid42 = _errs395 === errors2;
                                                              } else {
                                                                var valid42 = true;
                                                              }
                                                              if (valid42) {
                                                                if (data176.providerBilledMicroUsd !== void 0) {
                                                                  let data186 = data176.providerBilledMicroUsd;
                                                                  const _errs396 = errors2;
                                                                  if (!(data186 === "measured" || data186 === "estimated" || data186 === "inside-another-counter" || data186 === "unresolved" || data186 === "unavailable")) {
                                                                    validate29.errors = [{ instancePath: instancePath + "/categories/providerBilledMicroUsd", schemaPath: "#/properties/categories/properties/providerBilledMicroUsd/enum", keyword: "enum", params: { allowedValues: schema40.properties.categories.properties.providerBilledMicroUsd.enum }, message: "must be equal to one of the allowed values" }];
                                                                    return false;
                                                                  }
                                                                  var valid42 = _errs396 === errors2;
                                                                } else {
                                                                  var valid42 = true;
                                                                }
                                                                if (valid42) {
                                                                  if (data176.subagentCost !== void 0) {
                                                                    let data187 = data176.subagentCost;
                                                                    const _errs397 = errors2;
                                                                    if (!(data187 === "measured" || data187 === "estimated" || data187 === "inside-another-counter" || data187 === "unresolved" || data187 === "unavailable")) {
                                                                      validate29.errors = [{ instancePath: instancePath + "/categories/subagentCost", schemaPath: "#/properties/categories/properties/subagentCost/enum", keyword: "enum", params: { allowedValues: schema40.properties.categories.properties.subagentCost.enum }, message: "must be equal to one of the allowed values" }];
                                                                      return false;
                                                                    }
                                                                    var valid42 = _errs397 === errors2;
                                                                  } else {
                                                                    var valid42 = true;
                                                                  }
                                                                  if (valid42) {
                                                                    if (data176.compactionCost !== void 0) {
                                                                      let data188 = data176.compactionCost;
                                                                      const _errs398 = errors2;
                                                                      if (!(data188 === "measured" || data188 === "estimated" || data188 === "inside-another-counter" || data188 === "unresolved" || data188 === "unavailable")) {
                                                                        validate29.errors = [{ instancePath: instancePath + "/categories/compactionCost", schemaPath: "#/properties/categories/properties/compactionCost/enum", keyword: "enum", params: { allowedValues: schema40.properties.categories.properties.compactionCost.enum }, message: "must be equal to one of the allowed values" }];
                                                                        return false;
                                                                      }
                                                                      var valid42 = _errs398 === errors2;
                                                                    } else {
                                                                      var valid42 = true;
                                                                    }
                                                                    if (valid42) {
                                                                      if (data176.verificationCost !== void 0) {
                                                                        let data189 = data176.verificationCost;
                                                                        const _errs399 = errors2;
                                                                        if (!(data189 === "measured" || data189 === "estimated" || data189 === "inside-another-counter" || data189 === "unresolved" || data189 === "unavailable")) {
                                                                          validate29.errors = [{ instancePath: instancePath + "/categories/verificationCost", schemaPath: "#/properties/categories/properties/verificationCost/enum", keyword: "enum", params: { allowedValues: schema40.properties.categories.properties.verificationCost.enum }, message: "must be equal to one of the allowed values" }];
                                                                          return false;
                                                                        }
                                                                        var valid42 = _errs399 === errors2;
                                                                      } else {
                                                                        var valid42 = true;
                                                                      }
                                                                      if (valid42) {
                                                                        if (data176.infrastructureCost !== void 0) {
                                                                          let data190 = data176.infrastructureCost;
                                                                          const _errs400 = errors2;
                                                                          if (!(data190 === "measured" || data190 === "estimated" || data190 === "inside-another-counter" || data190 === "unresolved" || data190 === "unavailable")) {
                                                                            validate29.errors = [{ instancePath: instancePath + "/categories/infrastructureCost", schemaPath: "#/properties/categories/properties/infrastructureCost/enum", keyword: "enum", params: { allowedValues: schema40.properties.categories.properties.infrastructureCost.enum }, message: "must be equal to one of the allowed values" }];
                                                                            return false;
                                                                          }
                                                                          var valid42 = _errs400 === errors2;
                                                                        } else {
                                                                          var valid42 = true;
                                                                        }
                                                                        if (valid42) {
                                                                          if (data176.retryCost !== void 0) {
                                                                            let data191 = data176.retryCost;
                                                                            const _errs401 = errors2;
                                                                            if (!(data191 === "measured" || data191 === "estimated" || data191 === "inside-another-counter" || data191 === "unresolved" || data191 === "unavailable")) {
                                                                              validate29.errors = [{ instancePath: instancePath + "/categories/retryCost", schemaPath: "#/properties/categories/properties/retryCost/enum", keyword: "enum", params: { allowedValues: schema40.properties.categories.properties.retryCost.enum }, message: "must be equal to one of the allowed values" }];
                                                                              return false;
                                                                            }
                                                                            var valid42 = _errs401 === errors2;
                                                                          } else {
                                                                            var valid42 = true;
                                                                          }
                                                                          if (valid42) {
                                                                            if (data176.fallbackCost !== void 0) {
                                                                              let data192 = data176.fallbackCost;
                                                                              const _errs402 = errors2;
                                                                              if (!(data192 === "measured" || data192 === "estimated" || data192 === "inside-another-counter" || data192 === "unresolved" || data192 === "unavailable")) {
                                                                                validate29.errors = [{ instancePath: instancePath + "/categories/fallbackCost", schemaPath: "#/properties/categories/properties/fallbackCost/enum", keyword: "enum", params: { allowedValues: schema40.properties.categories.properties.fallbackCost.enum }, message: "must be equal to one of the allowed values" }];
                                                                                return false;
                                                                              }
                                                                              var valid42 = _errs402 === errors2;
                                                                            } else {
                                                                              var valid42 = true;
                                                                            }
                                                                            if (valid42) {
                                                                              if (data176.extractionCost !== void 0) {
                                                                                let data193 = data176.extractionCost;
                                                                                const _errs403 = errors2;
                                                                                if (!(data193 === "measured" || data193 === "estimated" || data193 === "inside-another-counter" || data193 === "unresolved" || data193 === "unavailable")) {
                                                                                  validate29.errors = [{ instancePath: instancePath + "/categories/extractionCost", schemaPath: "#/properties/categories/properties/extractionCost/enum", keyword: "enum", params: { allowedValues: schema40.properties.categories.properties.extractionCost.enum }, message: "must be equal to one of the allowed values" }];
                                                                                  return false;
                                                                                }
                                                                                var valid42 = _errs403 === errors2;
                                                                              } else {
                                                                                var valid42 = true;
                                                                              }
                                                                              if (valid42) {
                                                                                if (data176.activityCapacity !== void 0) {
                                                                                  let data194 = data176.activityCapacity;
                                                                                  const _errs404 = errors2;
                                                                                  if (!(data194 === "measured" || data194 === "estimated" || data194 === "inside-another-counter" || data194 === "unresolved" || data194 === "unavailable")) {
                                                                                    validate29.errors = [{ instancePath: instancePath + "/categories/activityCapacity", schemaPath: "#/properties/categories/properties/activityCapacity/enum", keyword: "enum", params: { allowedValues: schema40.properties.categories.properties.activityCapacity.enum }, message: "must be equal to one of the allowed values" }];
                                                                                    return false;
                                                                                  }
                                                                                  var valid42 = _errs404 === errors2;
                                                                                } else {
                                                                                  var valid42 = true;
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
                                                  }
                                                }
                                              }
                                            }
                                          }
                                        } else {
                                          validate29.errors = [{ instancePath: instancePath + "/categories", schemaPath: "#/properties/categories/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                          return false;
                                        }
                                      }
                                      var valid0 = _errs384 === errors2;
                                    } else {
                                      var valid0 = true;
                                    }
                                    if (valid0) {
                                      if (data.occupiedCapacity !== void 0) {
                                        let data195 = data.occupiedCapacity;
                                        const _errs405 = errors2;
                                        if (errors2 === _errs405) {
                                          if (data195 && typeof data195 == "object" && !Array.isArray(data195)) {
                                            let missing32;
                                            if (data195.status === void 0 && (missing32 = "status") || data195.reason === void 0 && (missing32 = "reason")) {
                                              validate29.errors = [{ instancePath: instancePath + "/occupiedCapacity", schemaPath: "#/properties/occupiedCapacity/required", keyword: "required", params: { missingProperty: missing32 }, message: "must have required property '" + missing32 + "'" }];
                                              return false;
                                            } else {
                                              const _errs407 = errors2;
                                              for (const key32 in data195) {
                                                if (!(key32 === "status" || key32 === "reason")) {
                                                  validate29.errors = [{ instancePath: instancePath + "/occupiedCapacity", schemaPath: "#/properties/occupiedCapacity/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key32 }, message: "must NOT have additional properties" }];
                                                  return false;
                                                  break;
                                                }
                                              }
                                              if (_errs407 === errors2) {
                                                if (data195.status !== void 0) {
                                                  const _errs408 = errors2;
                                                  if ("unavailable" !== data195.status) {
                                                    validate29.errors = [{ instancePath: instancePath + "/occupiedCapacity/status", schemaPath: "#/properties/occupiedCapacity/properties/status/const", keyword: "const", params: { allowedValue: "unavailable" }, message: "must be equal to constant" }];
                                                    return false;
                                                  }
                                                  var valid43 = _errs408 === errors2;
                                                } else {
                                                  var valid43 = true;
                                                }
                                                if (valid43) {
                                                  if (data195.reason !== void 0) {
                                                    let data197 = data195.reason;
                                                    const _errs409 = errors2;
                                                    if (errors2 === _errs409) {
                                                      if (typeof data197 === "string") {
                                                        if (func6(data197) > 1024) {
                                                          validate29.errors = [{ instancePath: instancePath + "/occupiedCapacity/reason", schemaPath: "#/properties/occupiedCapacity/properties/reason/maxLength", keyword: "maxLength", params: { limit: 1024 }, message: "must NOT have more than 1024 characters" }];
                                                          return false;
                                                        } else {
                                                          if (func6(data197) < 1) {
                                                            validate29.errors = [{ instancePath: instancePath + "/occupiedCapacity/reason", schemaPath: "#/properties/occupiedCapacity/properties/reason/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                            return false;
                                                          }
                                                        }
                                                      } else {
                                                        validate29.errors = [{ instancePath: instancePath + "/occupiedCapacity/reason", schemaPath: "#/properties/occupiedCapacity/properties/reason/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                        return false;
                                                      }
                                                    }
                                                    var valid43 = _errs409 === errors2;
                                                  } else {
                                                    var valid43 = true;
                                                  }
                                                }
                                              }
                                            }
                                          } else {
                                            validate29.errors = [{ instancePath: instancePath + "/occupiedCapacity", schemaPath: "#/properties/occupiedCapacity/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                            return false;
                                          }
                                        }
                                        var valid0 = _errs405 === errors2;
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

// conversation-usage/overview-protocol.mjs
var USAGE_OVERVIEW_SCHEMA = "meri.usage-overview/1";
var USAGE_OVERVIEW_PATH = "/api/conversations/usage-overview";
var overviewStates = Object.freeze(["queued", "starting", "running", "waiting-for-approval", "paused", "completed", "failed", "cancelled"]);
var usageOverviewErrors = Object.freeze({ INVALID_REQUEST: [400], UNAUTHENTICATED: [401], ACCESS_DENIED: [403], MEMBERSHIP_REVOKED: [403], NOT_FOUND: [404], METHOD_NOT_ALLOWED: [405], DEADLINE: [408], MEMBERSHIP_CHANGED: [409], REQUEST_TOO_LARGE: [413], UNSUPPORTED_MEDIA_TYPE: [415], CANCELLED: [499], PRODUCT_UNAVAILABLE: [502], USAGE_OVERVIEW_REQUEST_INVALID: [400], USAGE_OVERVIEW_CORRUPT: [500], USAGE_OVERVIEW_UNAVAILABLE: [503] });
var usageOverviewMetadata = Object.freeze({
  schemaId: "urn:meri:usage-overview:1.0.0",
  version: "1.0.0",
  path: USAGE_OVERVIEW_PATH,
  method: "POST",
  requestBytes: 1024,
  responseBytes: 16384,
  authentication: "current native tenant membership, rechecked before release",
  scope: "tenant aggregate numbers only; no conversation, client or other member identifiers",
  currency: "USD",
  money: "integer micro-USD of known recorded SDK estimates; missing or unavailable accounting is not zero cost",
  periods: "UTC day, ISO Monday week and calendar month; attempt cohorts use run.createdAt, admission cap uses sdk_usage_recorded_at",
  limits: "current canonical SDK limits and tenant admission cap; no reservations or budget editing",
  capacity: "recorded durable states only; no physical worker concurrency or available capacity observation",
  economics: "attempts are not complete jobs; provider billing and complete-job economics unavailable"
});
function usageOverviewPeriods(at) {
  const date = new Date(at);
  if (!Number.isSafeInteger(at) || !Number.isFinite(date.getTime())) throw Error("USAGE_OVERVIEW_CLOCK");
  const day = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()), week = day - (date.getUTCDay() + 6) % 7 * 864e5;
  const month = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1), nextMonth = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
  return [["day", day, day + 864e5], ["week", week, week + 7 * 864e5], ["month", month, nextMonth]].map(([kind, start, end]) => ({ kind, startInclusive: new Date(start).toISOString(), endExclusive: new Date(end).toISOString() }));
}
var USAGE_OVERVIEW_SCHEMA_V2 = "meri.usage-overview/2";
var usageOverviewLineageClasses = Object.freeze(["root", "fork", "resume", "unknown-lineage"]);
var usageOverviewCounterNames = Object.freeze(["inputTokens", "outputTokens", "cacheReadInputTokens", "cacheCreationInputTokens", "webSearchRequests", "toolInvocations", "toolFailures"]);
var usageOverviewBases = Object.freeze(["measured", "estimated", "inside-another-counter", "unresolved", "unavailable"]);
var usageOverviewCostCategories = Object.freeze({
  inputTokens: "measured",
  outputTokens: "measured",
  reasoningTokens: "inside-another-counter",
  cacheReadInputTokens: "measured",
  cacheCreationInputTokens: "measured",
  webSearchRequests: "measured",
  toolInvocations: "measured",
  toolOutcomes: "measured",
  cost: "estimated",
  providerBilledMicroUsd: "unresolved",
  subagentCost: "inside-another-counter",
  compactionCost: "inside-another-counter",
  verificationCost: "unresolved",
  infrastructureCost: "unresolved",
  retryCost: "unresolved",
  fallbackCost: "unresolved",
  extractionCost: "unresolved",
  activityCapacity: "unresolved"
});
var usageOverviewDenominators = Object.freeze({
  attempts: "run rows in the ledger; one run is one attempt or turn, never a job",
  conversationThreads: "distinct conversation_id with at least one run created in the period; a thread may host several attempts",
  sustainedJobs: "canonical ROOT Work/Delegate objectives: the run whose stored request carries request.work with entry start-work|delegate, together with every run that continues it through the persisted continuation custody. A child assignment, conversation thread, SDK attempt or one completed run is never a job"
});
var usageOverviewJobStates = Object.freeze(["successful", "partial", "failed", "cancelled", "unclosed"]);
var usageOverviewJobWindow = "root revision created within the admitted month window";
var usageOverviewJobWindowEdge = "a revision created after the window is not read, so a job whose continuation falls outside the window is reported from the revisions inside it only, and a continuation whose root revision is outside the window is excluded and counted";
var usageOverviewJobDefinition = "one whole job is the canonical ROOT Work/Delegate objective across its continuations and current goal revision; it is never a child assignment, conversation thread, SDK attempt or one completed run";
var usageOverviewJobLineage = "a run continues another objective only when the canonical continuation owner verifies that run stored continuation envelope in the same transaction and that envelope is a resume naming that source run stored request, so its source request digest equals the source run request_sha256; a fork and a run without that verified custody each start a new objective, because the canonical prompt identity owner makes a fork and a next prompt new logical prompts";
var usageOverviewJobClosure = "the existing completion producer decides. successful = every current revision is completed and carries a PUBLISHED native-session completion capture whose identity pins that revision, with no unresolved successor and no unsettled child receipt; failed = every current revision reached failed; cancelled = every current revision reached cancelled; partial = a current revision is still in flight, or terminal revisions carry mixed outcomes; unclosed = a current revision is terminal without that closure proof, or a continuation control is unresolved (not APPLIED, or its successor revision is outside this read window), or a child receipt is unresolved";
var usageOverviewJobInterface = Object.freeze({
  owner: "the existing lifecycle completion producer (meri_conversations.completion_checkpoints) read over the existing run and control lineage; no second store, ledger, scheduler or table is created",
  read: "per objective: the root revision digest, every continuation revision, each revision recorded run state, its canonical continuation custody verdict, its published native-session completion capture, its last APPLIED steer control and its child assignment/result settlement counts",
  identity: "the root revision digest (request_sha256 of the job-start run) plus the current goal revision (tail run request_sha256 and the last APPLIED steer control controlId, inputSha256 and controlSequence, exactly as the child-assignment revision owner reports them: assertRevision in lifecycle/child-assignments.mjs)",
  closure: "a revision is settled when the completion producer published its native-session capture for that revision; the objective closes only when every current revision is settled with no unresolved successor and no unsettled child, where a continuation control is unresolved unless it is APPLIED and its successor revision is a work revision inside this read window",
  absent: "a run without request.work is not a job; an objective whose current revisions are not settled stays unclosed and is never counted successful"
});
var usageOverviewMetadataV2 = Object.freeze({
  ...usageOverviewMetadata,
  schemaId: "urn:meri:usage-overview:2.0.0",
  version: "2.0.0",
  responseBytes: 32768,
  periods: "UTC day, ISO Monday week and calendar month; attempt cohorts and conversation threads use run.createdAt, whole jobs use the root revision createdAt, admission cap uses sdk_usage_recorded_at",
  economics: "attempts, conversation threads and canonical root Work/Delegate objectives with successful/partial/failed/cancelled/unclosed separated; the charge is an SDK list-price estimate; provider billing and physical capacity are unavailable"
});

// conversation-usage/overview-semantics.mjs
var UsageOverviewResponseError = class extends Error {
  constructor(code) {
    super(code);
    this.name = "UsageOverviewResponseError";
    this.code = code;
  }
};
var overviewFail = (code) => {
  throw new UsageOverviewResponseError(code);
};
function assertUsageOverviewSemantics(value) {
  const periods = usageOverviewPeriods(Date.parse(value.observedAt));
  for (let i = 0; i < 3; i++) {
    const p = value.periods[i], expected = periods[i];
    if (p.kind !== expected.kind || p.startInclusive !== expected.startInclusive || p.endExclusive !== expected.endExclusive || overviewStates.reduce((total2, state) => total2 + p.states[state], 0) !== p.attempts || Object.values(p.recording).reduce((a, b) => a + b, 0) !== p.attempts || p.completedAttemptsWithRecordedUsage > p.states.completed || p.completedAttemptsWithRecordedUsage > p.recording.recorded || p.completedAttemptKnownChargeMicroUsd > p.knownChargeMicroUsd || p.recording.recorded === 0 && p.knownChargeMicroUsd !== 0 || p.completedAttemptsWithRecordedUsage === 0 && p.completedAttemptKnownChargeMicroUsd !== 0) overviewFail("INVALID_USAGE_OVERVIEW");
  }
  const admission = value.monthlyAdmission, cap = value.policy.monthlyCapMicroUsd;
  if (admission.startInclusive !== periods[2].startInclusive || admission.remainingKnownMicroUsd !== (cap === null ? null : Math.max(0, cap - admission.knownChargeMicroUsd)) || admission.reached !== (cap === null ? null : admission.knownChargeMicroUsd >= cap) || overviewStates.slice(5).some((state) => value.queue.states[state] !== 0)) overviewFail("INVALID_USAGE_OVERVIEW");
  return value;
}
var rate = (charge, units) => units === 0 ? null : Number((charge / units).toFixed(6));
var total = (object, keys) => keys.reduce((sum, key) => sum + object[key], 0);
var lineageTotal = (lineage) => usageOverviewLineageClasses.reduce((sum, name) => sum + lineage[name].attempts, 0);
var same = (actual, expected) => actual !== null && typeof actual === "object" && Object.keys(expected).every((key) => actual[key] === expected[key]) && Object.keys(actual).length === Object.keys(expected).length;
function assertUsageOverviewSemanticsV2(value) {
  const periods = usageOverviewPeriods(Date.parse(value.observedAt));
  for (let i = 0; i < 3; i++) {
    const p = value.periods[i], expected = periods[i];
    if (p.kind !== expected.kind || p.startInclusive !== expected.startInclusive || p.endExclusive !== expected.endExclusive || total(p.states, overviewStates) !== p.attempts || total(p.recording, ["recorded", "unavailable", "notRecorded"]) !== p.attempts || total(p.recorded, overviewStates) !== p.recording.recorded || p.recorded.completed > p.states.completed || p.recorded.failed > p.states.failed || p.recorded.cancelled > p.states.cancelled || lineageTotal(p.lineage) !== p.attempts || p.counters.toolFailures > p.counters.toolInvocations) overviewFail("INVALID_USAGE_OVERVIEW");
    if (typeof p.lineage.basis !== "string" || usageOverviewLineageClasses.some((name) => p.lineage[name] === void 0)) overviewFail("INVALID_USAGE_OVERVIEW");
    const threads = p.conversationThreads;
    if (threads.status === "unavailable" ? threads.threads !== null || threads.attempts !== null : threads.attempts !== p.attempts || threads.threads > p.attempts) overviewFail("INVALID_USAGE_OVERVIEW");
    const completed = p.completedAttempts;
    if (completed.attempts !== p.recorded.completed || completed.attemptsWithoutRecordedUsage !== p.states.completed - p.recorded.completed || completed.status !== (completed.attempts === 0 ? "unavailable" : "estimated") || completed.jobIdentity !== "not-a-job-denominator" || completed.microUsdPerCompletedAttempt !== rate(completed.knownChargeMicroUsd, completed.attempts)) overviewFail("INVALID_USAGE_OVERVIEW");
    const partial = p.partialOrFailed, partialRecorded = p.recorded.failed + p.recorded.cancelled;
    if (partial.failedAttempts !== p.states.failed || partial.cancelledAttempts !== p.states.cancelled || partial.recordedAttempts !== partialRecorded || partial.status !== (partial.recordedAttempts === 0 ? "unavailable" : "estimated") || partial.microUsdPerRecordedAttempt !== rate(partial.knownChargeMicroUsd, partial.recordedAttempts)) overviewFail("INVALID_USAGE_OVERVIEW");
    const liability = p.liability;
    if (liability.recordedAttempts !== p.recording.recorded || liability.unavailableAttempts !== p.recording.unavailable || liability.notRecordedAttempts !== p.recording.notRecorded || liability.microUsdPerRecordedAttempt !== rate(liability.knownChargeMicroUsd, liability.recordedAttempts)) overviewFail("INVALID_USAGE_OVERVIEW");
  }
  const admission = value.monthlyAdmission, cap = value.policy.monthlyCapMicroUsd;
  if (admission.startInclusive !== periods[2].startInclusive || admission.remainingKnownMicroUsd !== (cap === null ? null : Math.max(0, cap - admission.knownChargeMicroUsd)) || admission.reached !== (cap === null ? null : admission.knownChargeMicroUsd >= cap) || overviewStates.slice(5).some((state) => value.queue.states[state] !== 0) || value.timezone !== "UTC" || value.currency !== "USD" || value.countersCoverage !== "recorded-runs-only" || value.occupiedCapacity.status !== "unavailable" || value.coverage.providerBilledMicroUsd !== null || value.coverage.completeJobCost !== "estimated" || value.queue.capacityStatus !== "unavailable" || value.queue.physicalConcurrency !== null || value.queue.availableCapacity !== null || !same(value.denominators, usageOverviewDenominators) || !same(value.categories, usageOverviewCostCategories)) overviewFail("INVALID_USAGE_OVERVIEW");
  const identity = value.jobIdentity, whole = value.wholeJobs;
  const zeroed = ["attempts", "revisions", "steerRevisions", "tails", "settledRevisions", "closurePending", "unresolvedSuccessors", "unsettledChildren", "knownChargeMicroUsd"];
  if (identity.status !== "measured" || identity.definition !== usageOverviewJobDefinition || identity.lineage !== usageOverviewJobLineage || identity.closure !== usageOverviewJobClosure || identity.owner !== usageOverviewJobInterface.owner || identity.states.length !== usageOverviewJobStates.length || usageOverviewJobStates.some((state, index) => identity.states[index] !== state) || whole.basis !== usageOverviewDenominators.sustainedJobs || whole.window !== usageOverviewJobWindow || usageOverviewJobStates.some((state) => whole.states[state] === null || typeof whole.states[state] !== "object") || usageOverviewJobStates.reduce((sum, state) => sum + whole.states[state].jobs, 0) !== whole.jobs || usageOverviewJobStates.reduce((sum, state) => sum + whole.states[state].attempts, 0) !== whole.attempts || usageOverviewJobStates.reduce((sum, state) => sum + whole.states[state].knownChargeMicroUsd, 0) !== whole.knownChargeMicroUsd || whole.revisions !== whole.attempts || whole.jobs > whole.tails || whole.tails > whole.revisions || whole.settledRevisions > whole.revisions || whole.steerRevisions > whole.revisions || whole.microUsdPerSuccessfulJob !== rate(whole.states.successful.knownChargeMicroUsd, whole.states.successful.jobs) || whole.coverage.jobsWithRecordedUsage + whole.coverage.jobsWithUnavailableUsage > whole.jobs || whole.coverage.chargeAttribution !== "whole-job-lineage-at-root-revision-window" || whole.coverage.windowEdge !== usageOverviewJobWindowEdge || whole.coverage.providerBilledMicroUsd !== null || whole.coverage.completeJobCost !== "estimated" || whole.jobs === 0 && (zeroed.some((key) => whole[key] !== 0) || whole.coverage.jobsWithRecordedUsage !== 0 || whole.coverage.jobsWithUnavailableUsage !== 0)) overviewFail("INVALID_USAGE_OVERVIEW");
  return value;
}

// conversation-usage/overview-receive.mjs
var requests = /* @__PURE__ */ new WeakSet();
var requestsV2 = /* @__PURE__ */ new WeakSet();
function parse(bytes, limit) {
  try {
    return parseBytes(bytes, limit);
  } catch {
    overviewFail("INVALID_BYTES");
  }
}
function receiveUsageOverviewRequest(bytes) {
  const value = parse(bytes, usageOverviewMetadata.requestBytes);
  if (!validateOverviewRequest(value)) overviewFail("USAGE_OVERVIEW_REQUEST_INVALID");
  requests.add(value);
  return value;
}
function receiveUsageOverviewResponse(status, bytes, request) {
  if (!requests.has(request)) overviewFail("UNADMITTED_REQUEST");
  const value = parse(bytes, usageOverviewMetadata.responseBytes);
  if (status !== 200) {
    const error = value?.error;
    if (!Number.isInteger(status) || !value || Object.keys(value).length !== 1 || !error || !Object.hasOwn(usageOverviewErrors, error.code) || !usageOverviewErrors[error.code].includes(status) || Object.keys(error).some((key) => !["code", "outcome"].includes(key)) || Object.hasOwn(error, "outcome") && (error.code !== "USAGE_OVERVIEW_UNAVAILABLE" || error.outcome !== "UNKNOWN")) overviewFail("INVALID_ERROR_RESPONSE");
    return value;
  }
  if (!validateOverviewResponse(value)) overviewFail("INVALID_USAGE_OVERVIEW");
  return assertUsageOverviewSemantics(value);
}
function receiveUsageOverviewRequestV2(bytes) {
  const value = parse(bytes, usageOverviewMetadataV2.requestBytes);
  if (!validateOverviewRequest2(value)) overviewFail("USAGE_OVERVIEW_REQUEST_INVALID");
  requestsV2.add(value);
  return value;
}
function receiveUsageOverviewResponseV2(status, bytes, request) {
  if (!requestsV2.has(request)) overviewFail("UNADMITTED_REQUEST");
  const value = parse(bytes, usageOverviewMetadataV2.responseBytes);
  if (status !== 200) {
    const error = value?.error;
    if (!Number.isInteger(status) || !value || Object.keys(value).length !== 1 || !error || !Object.hasOwn(usageOverviewErrors, error.code) || !usageOverviewErrors[error.code].includes(status) || Object.keys(error).some((key) => !["code", "outcome"].includes(key)) || Object.hasOwn(error, "outcome") && (error.code !== "USAGE_OVERVIEW_UNAVAILABLE" || error.outcome !== "UNKNOWN")) overviewFail("INVALID_ERROR_RESPONSE");
    return value;
  }
  if (!validateOverviewResponse2(value)) overviewFail("INVALID_USAGE_OVERVIEW");
  return assertUsageOverviewSemanticsV2(value);
}

// usage-generated:./generated-validator.mjs
var validateRequest = validate33;
var formats02 = /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
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
      if (data.schemaVersion === void 0 && (missing0 = "schemaVersion") || data.conversationId === void 0 && (missing0 = "conversationId") || data.runId === void 0 && (missing0 = "runId")) {
        validate33.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "schemaVersion" || key0 === "conversationId" || key0 === "runId")) {
            validate33.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.schemaVersion !== void 0) {
            const _errs2 = errors2;
            if ("meri.conversation-usage/1" !== data.schemaVersion) {
              validate33.errors = [{ instancePath: instancePath + "/schemaVersion", schemaPath: "#/properties/schemaVersion/const", keyword: "const", params: { allowedValue: "meri.conversation-usage/1" }, message: "must be equal to constant" }];
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
                if (errors2 === _errs3) {
                  if (typeof data1 === "string") {
                    if (!formats02.test(data1)) {
                      validate33.errors = [{ instancePath: instancePath + "/conversationId", schemaPath: "#/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                      return false;
                    }
                  } else {
                    validate33.errors = [{ instancePath: instancePath + "/conversationId", schemaPath: "#/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
                  }
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
                  if (errors2 === _errs5) {
                    if (typeof data2 === "string") {
                      if (!formats02.test(data2)) {
                        validate33.errors = [{ instancePath: instancePath + "/runId", schemaPath: "#/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                        return false;
                      }
                    } else {
                      validate33.errors = [{ instancePath: instancePath + "/runId", schemaPath: "#/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                      return false;
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
    } else {
      validate33.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate33.errors = vErrors;
  return errors2 === 0;
}
validate33.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var validateResponse = validate34;
var schema352 = { "type": "object", "properties": { "schemaVersion": { "const": "meri.conversation-usage/1" }, "conversationId": { "type": "string", "format": "uuid" }, "runId": { "type": "string", "format": "uuid" }, "recording": { "enum": ["not-recorded", "recorded"] }, "usage": { "anyOf": [{ "$ref": "#/$defs/RecordedUsage" }, { "type": "null" }] }, "toolAudit": { "anyOf": [{ "$ref": "#/$defs/RecordedToolAudit" }, { "type": "null" }] } }, "required": ["schemaVersion", "conversationId", "runId", "recording", "usage", "toolAudit"], "additionalProperties": false };
var schema36 = { "type": "object", "properties": { "status": { "enum": ["recorded", "unavailable"] }, "reason": { "anyOf": [{ "enum": ["configuration_mismatch", "result_unavailable", "baseline_mismatch", "baseline_unavailable", "baseline_configuration_mismatch", "lineage_unavailable", "counters_reset", "estimate_mismatch", "rates_unavailable", "amount_out_of_range"] }, { "type": "null" }] }, "currency": { "const": "USD" }, "runDelta": { "anyOf": [{ "$ref": "#/$defs/UsageRunDelta" }, { "type": "null" }] }, "cumulative": { "anyOf": [{ "$ref": "#/$defs/UsageCumulative" }, { "type": "null" }] }, "providerBilledUsd": { "type": "null" } }, "required": ["status", "reason", "currency", "runDelta", "cumulative", "providerBilledUsd"], "additionalProperties": false };
var func12 = require_ucs2length().default;
var pattern42 = new RegExp("^[a-zA-Z0-9][a-zA-Z0-9_:\\-./]{0,199}$", "u");
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
      if (data.sdkEstimateUsd === void 0 && (missing0 = "sdkEstimateUsd") || data.modelCounters === void 0 && (missing0 = "modelCounters")) {
        validate25.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "sdkEstimateUsd" || key0 === "modelCounters")) {
            validate25.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.sdkEstimateUsd !== void 0) {
            let data0 = data.sdkEstimateUsd;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (typeof data0 == "number" && isFinite(data0)) {
                if (data0 > 9007199254740992e-6 || isNaN(data0)) {
                  validate25.errors = [{ instancePath: instancePath + "/sdkEstimateUsd", schemaPath: "#/properties/sdkEstimateUsd/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740992e-6 }, message: "must be <= 9007199254.740992" }];
                  return false;
                } else {
                  if (data0 < 0 || isNaN(data0)) {
                    validate25.errors = [{ instancePath: instancePath + "/sdkEstimateUsd", schemaPath: "#/properties/sdkEstimateUsd/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                    return false;
                  }
                }
              } else {
                validate25.errors = [{ instancePath: instancePath + "/sdkEstimateUsd", schemaPath: "#/properties/sdkEstimateUsd/type", keyword: "type", params: { type: "number" }, message: "must be number" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.modelCounters !== void 0) {
              let data1 = data.modelCounters;
              const _errs4 = errors2;
              if (errors2 === _errs4) {
                if (Array.isArray(data1)) {
                  if (data1.length > 32) {
                    validate25.errors = [{ instancePath: instancePath + "/modelCounters", schemaPath: "#/properties/modelCounters/maxItems", keyword: "maxItems", params: { limit: 32 }, message: "must NOT have more than 32 items" }];
                    return false;
                  } else {
                    if (data1.length < 1) {
                      validate25.errors = [{ instancePath: instancePath + "/modelCounters", schemaPath: "#/properties/modelCounters/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                      return false;
                    } else {
                      var valid1 = true;
                      const len0 = data1.length;
                      for (let i0 = 0; i0 < len0; i0++) {
                        let data2 = data1[i0];
                        const _errs6 = errors2;
                        const _errs7 = errors2;
                        if (errors2 === _errs7) {
                          if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                            let missing1;
                            if (data2.model === void 0 && (missing1 = "model") || data2.inputTokens === void 0 && (missing1 = "inputTokens") || data2.outputTokens === void 0 && (missing1 = "outputTokens") || data2.cacheReadInputTokens === void 0 && (missing1 = "cacheReadInputTokens") || data2.cacheCreationInputTokens === void 0 && (missing1 = "cacheCreationInputTokens") || data2.webSearchRequests === void 0 && (missing1 = "webSearchRequests")) {
                              validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0, schemaPath: "#/$defs/UsageModelCounters/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                              return false;
                            } else {
                              const _errs9 = errors2;
                              for (const key1 in data2) {
                                if (!(key1 === "model" || key1 === "inputTokens" || key1 === "outputTokens" || key1 === "cacheReadInputTokens" || key1 === "cacheCreationInputTokens" || key1 === "webSearchRequests")) {
                                  validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0, schemaPath: "#/$defs/UsageModelCounters/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                                  return false;
                                  break;
                                }
                              }
                              if (_errs9 === errors2) {
                                if (data2.model !== void 0) {
                                  let data3 = data2.model;
                                  const _errs10 = errors2;
                                  if (errors2 === _errs10) {
                                    if (typeof data3 === "string") {
                                      if (func12(data3) > 200) {
                                        validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/model", schemaPath: "#/$defs/UsageModelCounters/properties/model/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" }];
                                        return false;
                                      } else {
                                        if (func12(data3) < 1) {
                                          validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/model", schemaPath: "#/$defs/UsageModelCounters/properties/model/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                          return false;
                                        } else {
                                          if (!pattern42.test(data3)) {
                                            validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/model", schemaPath: "#/$defs/UsageModelCounters/properties/model/pattern", keyword: "pattern", params: { pattern: "^[a-zA-Z0-9][a-zA-Z0-9_:\\-./]{0,199}$" }, message: 'must match pattern "^[a-zA-Z0-9][a-zA-Z0-9_:\\-./]{0,199}$"' }];
                                            return false;
                                          }
                                        }
                                      }
                                    } else {
                                      validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/model", schemaPath: "#/$defs/UsageModelCounters/properties/model/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                      return false;
                                    }
                                  }
                                  var valid3 = _errs10 === errors2;
                                } else {
                                  var valid3 = true;
                                }
                                if (valid3) {
                                  if (data2.inputTokens !== void 0) {
                                    let data4 = data2.inputTokens;
                                    const _errs12 = errors2;
                                    if (!(typeof data4 == "number" && (!(data4 % 1) && !isNaN(data4)) && isFinite(data4))) {
                                      validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/inputTokens", schemaPath: "#/$defs/UsageModelCounters/properties/inputTokens/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                      return false;
                                    }
                                    if (errors2 === _errs12) {
                                      if (typeof data4 == "number" && isFinite(data4)) {
                                        if (data4 > 9007199254740991 || isNaN(data4)) {
                                          validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/inputTokens", schemaPath: "#/$defs/UsageModelCounters/properties/inputTokens/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                          return false;
                                        } else {
                                          if (data4 < 0 || isNaN(data4)) {
                                            validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/inputTokens", schemaPath: "#/$defs/UsageModelCounters/properties/inputTokens/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                            return false;
                                          }
                                        }
                                      }
                                    }
                                    var valid3 = _errs12 === errors2;
                                  } else {
                                    var valid3 = true;
                                  }
                                  if (valid3) {
                                    if (data2.outputTokens !== void 0) {
                                      let data5 = data2.outputTokens;
                                      const _errs14 = errors2;
                                      if (!(typeof data5 == "number" && (!(data5 % 1) && !isNaN(data5)) && isFinite(data5))) {
                                        validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/outputTokens", schemaPath: "#/$defs/UsageModelCounters/properties/outputTokens/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                        return false;
                                      }
                                      if (errors2 === _errs14) {
                                        if (typeof data5 == "number" && isFinite(data5)) {
                                          if (data5 > 9007199254740991 || isNaN(data5)) {
                                            validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/outputTokens", schemaPath: "#/$defs/UsageModelCounters/properties/outputTokens/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                            return false;
                                          } else {
                                            if (data5 < 0 || isNaN(data5)) {
                                              validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/outputTokens", schemaPath: "#/$defs/UsageModelCounters/properties/outputTokens/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                              return false;
                                            }
                                          }
                                        }
                                      }
                                      var valid3 = _errs14 === errors2;
                                    } else {
                                      var valid3 = true;
                                    }
                                    if (valid3) {
                                      if (data2.cacheReadInputTokens !== void 0) {
                                        let data6 = data2.cacheReadInputTokens;
                                        const _errs16 = errors2;
                                        if (!(typeof data6 == "number" && (!(data6 % 1) && !isNaN(data6)) && isFinite(data6))) {
                                          validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/cacheReadInputTokens", schemaPath: "#/$defs/UsageModelCounters/properties/cacheReadInputTokens/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                          return false;
                                        }
                                        if (errors2 === _errs16) {
                                          if (typeof data6 == "number" && isFinite(data6)) {
                                            if (data6 > 9007199254740991 || isNaN(data6)) {
                                              validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/cacheReadInputTokens", schemaPath: "#/$defs/UsageModelCounters/properties/cacheReadInputTokens/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                              return false;
                                            } else {
                                              if (data6 < 0 || isNaN(data6)) {
                                                validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/cacheReadInputTokens", schemaPath: "#/$defs/UsageModelCounters/properties/cacheReadInputTokens/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                return false;
                                              }
                                            }
                                          }
                                        }
                                        var valid3 = _errs16 === errors2;
                                      } else {
                                        var valid3 = true;
                                      }
                                      if (valid3) {
                                        if (data2.cacheCreationInputTokens !== void 0) {
                                          let data7 = data2.cacheCreationInputTokens;
                                          const _errs18 = errors2;
                                          if (!(typeof data7 == "number" && (!(data7 % 1) && !isNaN(data7)) && isFinite(data7))) {
                                            validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/cacheCreationInputTokens", schemaPath: "#/$defs/UsageModelCounters/properties/cacheCreationInputTokens/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                            return false;
                                          }
                                          if (errors2 === _errs18) {
                                            if (typeof data7 == "number" && isFinite(data7)) {
                                              if (data7 > 9007199254740991 || isNaN(data7)) {
                                                validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/cacheCreationInputTokens", schemaPath: "#/$defs/UsageModelCounters/properties/cacheCreationInputTokens/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                return false;
                                              } else {
                                                if (data7 < 0 || isNaN(data7)) {
                                                  validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/cacheCreationInputTokens", schemaPath: "#/$defs/UsageModelCounters/properties/cacheCreationInputTokens/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                  return false;
                                                }
                                              }
                                            }
                                          }
                                          var valid3 = _errs18 === errors2;
                                        } else {
                                          var valid3 = true;
                                        }
                                        if (valid3) {
                                          if (data2.webSearchRequests !== void 0) {
                                            let data8 = data2.webSearchRequests;
                                            const _errs20 = errors2;
                                            if (!(typeof data8 == "number" && (!(data8 % 1) && !isNaN(data8)) && isFinite(data8))) {
                                              validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/webSearchRequests", schemaPath: "#/$defs/UsageModelCounters/properties/webSearchRequests/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                              return false;
                                            }
                                            if (errors2 === _errs20) {
                                              if (typeof data8 == "number" && isFinite(data8)) {
                                                if (data8 > 9007199254740991 || isNaN(data8)) {
                                                  validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/webSearchRequests", schemaPath: "#/$defs/UsageModelCounters/properties/webSearchRequests/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                  return false;
                                                } else {
                                                  if (data8 < 0 || isNaN(data8)) {
                                                    validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0 + "/webSearchRequests", schemaPath: "#/$defs/UsageModelCounters/properties/webSearchRequests/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                    return false;
                                                  }
                                                }
                                              }
                                            }
                                            var valid3 = _errs20 === errors2;
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
                          } else {
                            validate25.errors = [{ instancePath: instancePath + "/modelCounters/" + i0, schemaPath: "#/$defs/UsageModelCounters/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
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
                  validate25.errors = [{ instancePath: instancePath + "/modelCounters", schemaPath: "#/properties/modelCounters/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
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
      validate25.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate25.errors = vErrors;
  return errors2 === 0;
}
validate25.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var schema402 = { "type": "object", "properties": { "sdk": { "type": "string", "maxLength": 64, "pattern": "^\\d+\\.\\d+\\.\\d+$" }, "cli": { "type": "string", "maxLength": 64, "pattern": "^\\d+\\.\\d+\\.\\d+$" }, "provider": { "enum": ["bedrock", "claude-api"] }, "cacheWriteTtl": { "enum": ["5m", "1h"] }, "priceRevision": { "type": "string", "minLength": 1, "maxLength": 200, "pattern": "^[a-zA-Z0-9][a-zA-Z0-9_:\\-./]{0,199}$" } }, "required": ["sdk", "cli", "provider", "cacheWriteTtl", "priceRevision"], "additionalProperties": false };
var schema41 = { "type": "object", "properties": { "model": { "type": "string", "minLength": 1, "maxLength": 200, "pattern": "^[a-zA-Z0-9][a-zA-Z0-9_:\\-./]{0,199}$" }, "inputTokens": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "outputTokens": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "cacheReadInputTokens": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "cacheCreationInputTokens": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "webSearchRequests": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "sdkEstimateUsd": { "type": "number", "minimum": 0, "maximum": 9007199254740992e-6 }, "provider": { "enum": ["bedrock", "firstParty", "unknown"] }, "costBasis": { "enum": ["list", "unknown"] } }, "required": ["model", "inputTokens", "outputTokens", "cacheReadInputTokens", "cacheCreationInputTokens", "webSearchRequests", "sdkEstimateUsd", "provider", "costBasis"], "additionalProperties": false };
var func7 = Object.prototype.hasOwnProperty;
var pattern5 = new RegExp("^\\d+\\.\\d+\\.\\d+$", "u");
function validate272(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors2 = 0;
  const evaluated0 = validate272.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (errors2 === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.sdkEstimateUsd === void 0 && (missing0 = "sdkEstimateUsd") || data.basis === void 0 && (missing0 = "basis") || data.models === void 0 && (missing0 = "models")) {
        validate272.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "sdkEstimateUsd" || key0 === "basis" || key0 === "models")) {
            validate272.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.sdkEstimateUsd !== void 0) {
            let data0 = data.sdkEstimateUsd;
            const _errs2 = errors2;
            if (errors2 === _errs2) {
              if (typeof data0 == "number" && isFinite(data0)) {
                if (data0 > 9007199254740992e-6 || isNaN(data0)) {
                  validate272.errors = [{ instancePath: instancePath + "/sdkEstimateUsd", schemaPath: "#/properties/sdkEstimateUsd/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740992e-6 }, message: "must be <= 9007199254.740992" }];
                  return false;
                } else {
                  if (data0 < 0 || isNaN(data0)) {
                    validate272.errors = [{ instancePath: instancePath + "/sdkEstimateUsd", schemaPath: "#/properties/sdkEstimateUsd/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                    return false;
                  }
                }
              } else {
                validate272.errors = [{ instancePath: instancePath + "/sdkEstimateUsd", schemaPath: "#/properties/sdkEstimateUsd/type", keyword: "type", params: { type: "number" }, message: "must be number" }];
                return false;
              }
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.basis !== void 0) {
              let data1 = data.basis;
              const _errs4 = errors2;
              const _errs5 = errors2;
              if (errors2 === _errs5) {
                if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
                  let missing1;
                  if (data1.sdk === void 0 && (missing1 = "sdk") || data1.cli === void 0 && (missing1 = "cli") || data1.provider === void 0 && (missing1 = "provider") || data1.cacheWriteTtl === void 0 && (missing1 = "cacheWriteTtl") || data1.priceRevision === void 0 && (missing1 = "priceRevision")) {
                    validate272.errors = [{ instancePath: instancePath + "/basis", schemaPath: "#/$defs/UsageBasis/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                    return false;
                  } else {
                    const _errs7 = errors2;
                    for (const key1 in data1) {
                      if (!(key1 === "sdk" || key1 === "cli" || key1 === "provider" || key1 === "cacheWriteTtl" || key1 === "priceRevision")) {
                        validate272.errors = [{ instancePath: instancePath + "/basis", schemaPath: "#/$defs/UsageBasis/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                        return false;
                        break;
                      }
                    }
                    if (_errs7 === errors2) {
                      if (data1.sdk !== void 0) {
                        let data2 = data1.sdk;
                        const _errs8 = errors2;
                        if (errors2 === _errs8) {
                          if (typeof data2 === "string") {
                            if (func12(data2) > 64) {
                              validate272.errors = [{ instancePath: instancePath + "/basis/sdk", schemaPath: "#/$defs/UsageBasis/properties/sdk/maxLength", keyword: "maxLength", params: { limit: 64 }, message: "must NOT have more than 64 characters" }];
                              return false;
                            } else {
                              if (!pattern5.test(data2)) {
                                validate272.errors = [{ instancePath: instancePath + "/basis/sdk", schemaPath: "#/$defs/UsageBasis/properties/sdk/pattern", keyword: "pattern", params: { pattern: "^\\d+\\.\\d+\\.\\d+$" }, message: 'must match pattern "^\\d+\\.\\d+\\.\\d+$"' }];
                                return false;
                              }
                            }
                          } else {
                            validate272.errors = [{ instancePath: instancePath + "/basis/sdk", schemaPath: "#/$defs/UsageBasis/properties/sdk/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                            return false;
                          }
                        }
                        var valid2 = _errs8 === errors2;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data1.cli !== void 0) {
                          let data3 = data1.cli;
                          const _errs10 = errors2;
                          if (errors2 === _errs10) {
                            if (typeof data3 === "string") {
                              if (func12(data3) > 64) {
                                validate272.errors = [{ instancePath: instancePath + "/basis/cli", schemaPath: "#/$defs/UsageBasis/properties/cli/maxLength", keyword: "maxLength", params: { limit: 64 }, message: "must NOT have more than 64 characters" }];
                                return false;
                              } else {
                                if (!pattern5.test(data3)) {
                                  validate272.errors = [{ instancePath: instancePath + "/basis/cli", schemaPath: "#/$defs/UsageBasis/properties/cli/pattern", keyword: "pattern", params: { pattern: "^\\d+\\.\\d+\\.\\d+$" }, message: 'must match pattern "^\\d+\\.\\d+\\.\\d+$"' }];
                                  return false;
                                }
                              }
                            } else {
                              validate272.errors = [{ instancePath: instancePath + "/basis/cli", schemaPath: "#/$defs/UsageBasis/properties/cli/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                              return false;
                            }
                          }
                          var valid2 = _errs10 === errors2;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data1.provider !== void 0) {
                            let data4 = data1.provider;
                            const _errs12 = errors2;
                            if (!(data4 === "bedrock" || data4 === "claude-api")) {
                              validate272.errors = [{ instancePath: instancePath + "/basis/provider", schemaPath: "#/$defs/UsageBasis/properties/provider/enum", keyword: "enum", params: { allowedValues: schema402.properties.provider.enum }, message: "must be equal to one of the allowed values" }];
                              return false;
                            }
                            var valid2 = _errs12 === errors2;
                          } else {
                            var valid2 = true;
                          }
                          if (valid2) {
                            if (data1.cacheWriteTtl !== void 0) {
                              let data5 = data1.cacheWriteTtl;
                              const _errs13 = errors2;
                              if (!(data5 === "5m" || data5 === "1h")) {
                                validate272.errors = [{ instancePath: instancePath + "/basis/cacheWriteTtl", schemaPath: "#/$defs/UsageBasis/properties/cacheWriteTtl/enum", keyword: "enum", params: { allowedValues: schema402.properties.cacheWriteTtl.enum }, message: "must be equal to one of the allowed values" }];
                                return false;
                              }
                              var valid2 = _errs13 === errors2;
                            } else {
                              var valid2 = true;
                            }
                            if (valid2) {
                              if (data1.priceRevision !== void 0) {
                                let data6 = data1.priceRevision;
                                const _errs14 = errors2;
                                if (errors2 === _errs14) {
                                  if (typeof data6 === "string") {
                                    if (func12(data6) > 200) {
                                      validate272.errors = [{ instancePath: instancePath + "/basis/priceRevision", schemaPath: "#/$defs/UsageBasis/properties/priceRevision/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" }];
                                      return false;
                                    } else {
                                      if (func12(data6) < 1) {
                                        validate272.errors = [{ instancePath: instancePath + "/basis/priceRevision", schemaPath: "#/$defs/UsageBasis/properties/priceRevision/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                        return false;
                                      } else {
                                        if (!pattern42.test(data6)) {
                                          validate272.errors = [{ instancePath: instancePath + "/basis/priceRevision", schemaPath: "#/$defs/UsageBasis/properties/priceRevision/pattern", keyword: "pattern", params: { pattern: "^[a-zA-Z0-9][a-zA-Z0-9_:\\-./]{0,199}$" }, message: 'must match pattern "^[a-zA-Z0-9][a-zA-Z0-9_:\\-./]{0,199}$"' }];
                                          return false;
                                        }
                                      }
                                    }
                                  } else {
                                    validate272.errors = [{ instancePath: instancePath + "/basis/priceRevision", schemaPath: "#/$defs/UsageBasis/properties/priceRevision/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                  }
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
                  }
                } else {
                  validate272.errors = [{ instancePath: instancePath + "/basis", schemaPath: "#/$defs/UsageBasis/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                  return false;
                }
              }
              var valid0 = _errs4 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.models !== void 0) {
                let data7 = data.models;
                const _errs16 = errors2;
                if (errors2 === _errs16) {
                  if (Array.isArray(data7)) {
                    if (data7.length > 32) {
                      validate272.errors = [{ instancePath: instancePath + "/models", schemaPath: "#/properties/models/maxItems", keyword: "maxItems", params: { limit: 32 }, message: "must NOT have more than 32 items" }];
                      return false;
                    } else {
                      if (data7.length < 1) {
                        validate272.errors = [{ instancePath: instancePath + "/models", schemaPath: "#/properties/models/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                        return false;
                      } else {
                        var valid3 = true;
                        const len0 = data7.length;
                        for (let i0 = 0; i0 < len0; i0++) {
                          let data8 = data7[i0];
                          const _errs18 = errors2;
                          const _errs19 = errors2;
                          if (errors2 === _errs19) {
                            if (data8 && typeof data8 == "object" && !Array.isArray(data8)) {
                              let missing2;
                              if (data8.model === void 0 && (missing2 = "model") || data8.inputTokens === void 0 && (missing2 = "inputTokens") || data8.outputTokens === void 0 && (missing2 = "outputTokens") || data8.cacheReadInputTokens === void 0 && (missing2 = "cacheReadInputTokens") || data8.cacheCreationInputTokens === void 0 && (missing2 = "cacheCreationInputTokens") || data8.webSearchRequests === void 0 && (missing2 = "webSearchRequests") || data8.sdkEstimateUsd === void 0 && (missing2 = "sdkEstimateUsd") || data8.provider === void 0 && (missing2 = "provider") || data8.costBasis === void 0 && (missing2 = "costBasis")) {
                                validate272.errors = [{ instancePath: instancePath + "/models/" + i0, schemaPath: "#/$defs/UsageModelEstimate/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" }];
                                return false;
                              } else {
                                const _errs21 = errors2;
                                for (const key2 in data8) {
                                  if (!func7.call(schema41.properties, key2)) {
                                    validate272.errors = [{ instancePath: instancePath + "/models/" + i0, schemaPath: "#/$defs/UsageModelEstimate/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" }];
                                    return false;
                                    break;
                                  }
                                }
                                if (_errs21 === errors2) {
                                  if (data8.model !== void 0) {
                                    let data9 = data8.model;
                                    const _errs22 = errors2;
                                    if (errors2 === _errs22) {
                                      if (typeof data9 === "string") {
                                        if (func12(data9) > 200) {
                                          validate272.errors = [{ instancePath: instancePath + "/models/" + i0 + "/model", schemaPath: "#/$defs/UsageModelEstimate/properties/model/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" }];
                                          return false;
                                        } else {
                                          if (func12(data9) < 1) {
                                            validate272.errors = [{ instancePath: instancePath + "/models/" + i0 + "/model", schemaPath: "#/$defs/UsageModelEstimate/properties/model/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                            return false;
                                          } else {
                                            if (!pattern42.test(data9)) {
                                              validate272.errors = [{ instancePath: instancePath + "/models/" + i0 + "/model", schemaPath: "#/$defs/UsageModelEstimate/properties/model/pattern", keyword: "pattern", params: { pattern: "^[a-zA-Z0-9][a-zA-Z0-9_:\\-./]{0,199}$" }, message: 'must match pattern "^[a-zA-Z0-9][a-zA-Z0-9_:\\-./]{0,199}$"' }];
                                              return false;
                                            }
                                          }
                                        }
                                      } else {
                                        validate272.errors = [{ instancePath: instancePath + "/models/" + i0 + "/model", schemaPath: "#/$defs/UsageModelEstimate/properties/model/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                        return false;
                                      }
                                    }
                                    var valid5 = _errs22 === errors2;
                                  } else {
                                    var valid5 = true;
                                  }
                                  if (valid5) {
                                    if (data8.inputTokens !== void 0) {
                                      let data10 = data8.inputTokens;
                                      const _errs24 = errors2;
                                      if (!(typeof data10 == "number" && (!(data10 % 1) && !isNaN(data10)) && isFinite(data10))) {
                                        validate272.errors = [{ instancePath: instancePath + "/models/" + i0 + "/inputTokens", schemaPath: "#/$defs/UsageModelEstimate/properties/inputTokens/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                        return false;
                                      }
                                      if (errors2 === _errs24) {
                                        if (typeof data10 == "number" && isFinite(data10)) {
                                          if (data10 > 9007199254740991 || isNaN(data10)) {
                                            validate272.errors = [{ instancePath: instancePath + "/models/" + i0 + "/inputTokens", schemaPath: "#/$defs/UsageModelEstimate/properties/inputTokens/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                            return false;
                                          } else {
                                            if (data10 < 0 || isNaN(data10)) {
                                              validate272.errors = [{ instancePath: instancePath + "/models/" + i0 + "/inputTokens", schemaPath: "#/$defs/UsageModelEstimate/properties/inputTokens/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                              return false;
                                            }
                                          }
                                        }
                                      }
                                      var valid5 = _errs24 === errors2;
                                    } else {
                                      var valid5 = true;
                                    }
                                    if (valid5) {
                                      if (data8.outputTokens !== void 0) {
                                        let data11 = data8.outputTokens;
                                        const _errs26 = errors2;
                                        if (!(typeof data11 == "number" && (!(data11 % 1) && !isNaN(data11)) && isFinite(data11))) {
                                          validate272.errors = [{ instancePath: instancePath + "/models/" + i0 + "/outputTokens", schemaPath: "#/$defs/UsageModelEstimate/properties/outputTokens/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                          return false;
                                        }
                                        if (errors2 === _errs26) {
                                          if (typeof data11 == "number" && isFinite(data11)) {
                                            if (data11 > 9007199254740991 || isNaN(data11)) {
                                              validate272.errors = [{ instancePath: instancePath + "/models/" + i0 + "/outputTokens", schemaPath: "#/$defs/UsageModelEstimate/properties/outputTokens/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                              return false;
                                            } else {
                                              if (data11 < 0 || isNaN(data11)) {
                                                validate272.errors = [{ instancePath: instancePath + "/models/" + i0 + "/outputTokens", schemaPath: "#/$defs/UsageModelEstimate/properties/outputTokens/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                return false;
                                              }
                                            }
                                          }
                                        }
                                        var valid5 = _errs26 === errors2;
                                      } else {
                                        var valid5 = true;
                                      }
                                      if (valid5) {
                                        if (data8.cacheReadInputTokens !== void 0) {
                                          let data12 = data8.cacheReadInputTokens;
                                          const _errs28 = errors2;
                                          if (!(typeof data12 == "number" && (!(data12 % 1) && !isNaN(data12)) && isFinite(data12))) {
                                            validate272.errors = [{ instancePath: instancePath + "/models/" + i0 + "/cacheReadInputTokens", schemaPath: "#/$defs/UsageModelEstimate/properties/cacheReadInputTokens/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                            return false;
                                          }
                                          if (errors2 === _errs28) {
                                            if (typeof data12 == "number" && isFinite(data12)) {
                                              if (data12 > 9007199254740991 || isNaN(data12)) {
                                                validate272.errors = [{ instancePath: instancePath + "/models/" + i0 + "/cacheReadInputTokens", schemaPath: "#/$defs/UsageModelEstimate/properties/cacheReadInputTokens/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                return false;
                                              } else {
                                                if (data12 < 0 || isNaN(data12)) {
                                                  validate272.errors = [{ instancePath: instancePath + "/models/" + i0 + "/cacheReadInputTokens", schemaPath: "#/$defs/UsageModelEstimate/properties/cacheReadInputTokens/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                  return false;
                                                }
                                              }
                                            }
                                          }
                                          var valid5 = _errs28 === errors2;
                                        } else {
                                          var valid5 = true;
                                        }
                                        if (valid5) {
                                          if (data8.cacheCreationInputTokens !== void 0) {
                                            let data13 = data8.cacheCreationInputTokens;
                                            const _errs30 = errors2;
                                            if (!(typeof data13 == "number" && (!(data13 % 1) && !isNaN(data13)) && isFinite(data13))) {
                                              validate272.errors = [{ instancePath: instancePath + "/models/" + i0 + "/cacheCreationInputTokens", schemaPath: "#/$defs/UsageModelEstimate/properties/cacheCreationInputTokens/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                              return false;
                                            }
                                            if (errors2 === _errs30) {
                                              if (typeof data13 == "number" && isFinite(data13)) {
                                                if (data13 > 9007199254740991 || isNaN(data13)) {
                                                  validate272.errors = [{ instancePath: instancePath + "/models/" + i0 + "/cacheCreationInputTokens", schemaPath: "#/$defs/UsageModelEstimate/properties/cacheCreationInputTokens/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                  return false;
                                                } else {
                                                  if (data13 < 0 || isNaN(data13)) {
                                                    validate272.errors = [{ instancePath: instancePath + "/models/" + i0 + "/cacheCreationInputTokens", schemaPath: "#/$defs/UsageModelEstimate/properties/cacheCreationInputTokens/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                    return false;
                                                  }
                                                }
                                              }
                                            }
                                            var valid5 = _errs30 === errors2;
                                          } else {
                                            var valid5 = true;
                                          }
                                          if (valid5) {
                                            if (data8.webSearchRequests !== void 0) {
                                              let data14 = data8.webSearchRequests;
                                              const _errs32 = errors2;
                                              if (!(typeof data14 == "number" && (!(data14 % 1) && !isNaN(data14)) && isFinite(data14))) {
                                                validate272.errors = [{ instancePath: instancePath + "/models/" + i0 + "/webSearchRequests", schemaPath: "#/$defs/UsageModelEstimate/properties/webSearchRequests/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                return false;
                                              }
                                              if (errors2 === _errs32) {
                                                if (typeof data14 == "number" && isFinite(data14)) {
                                                  if (data14 > 9007199254740991 || isNaN(data14)) {
                                                    validate272.errors = [{ instancePath: instancePath + "/models/" + i0 + "/webSearchRequests", schemaPath: "#/$defs/UsageModelEstimate/properties/webSearchRequests/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                    return false;
                                                  } else {
                                                    if (data14 < 0 || isNaN(data14)) {
                                                      validate272.errors = [{ instancePath: instancePath + "/models/" + i0 + "/webSearchRequests", schemaPath: "#/$defs/UsageModelEstimate/properties/webSearchRequests/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                      return false;
                                                    }
                                                  }
                                                }
                                              }
                                              var valid5 = _errs32 === errors2;
                                            } else {
                                              var valid5 = true;
                                            }
                                            if (valid5) {
                                              if (data8.sdkEstimateUsd !== void 0) {
                                                let data15 = data8.sdkEstimateUsd;
                                                const _errs34 = errors2;
                                                if (errors2 === _errs34) {
                                                  if (typeof data15 == "number" && isFinite(data15)) {
                                                    if (data15 > 9007199254740992e-6 || isNaN(data15)) {
                                                      validate272.errors = [{ instancePath: instancePath + "/models/" + i0 + "/sdkEstimateUsd", schemaPath: "#/$defs/UsageModelEstimate/properties/sdkEstimateUsd/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740992e-6 }, message: "must be <= 9007199254.740992" }];
                                                      return false;
                                                    } else {
                                                      if (data15 < 0 || isNaN(data15)) {
                                                        validate272.errors = [{ instancePath: instancePath + "/models/" + i0 + "/sdkEstimateUsd", schemaPath: "#/$defs/UsageModelEstimate/properties/sdkEstimateUsd/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                        return false;
                                                      }
                                                    }
                                                  } else {
                                                    validate272.errors = [{ instancePath: instancePath + "/models/" + i0 + "/sdkEstimateUsd", schemaPath: "#/$defs/UsageModelEstimate/properties/sdkEstimateUsd/type", keyword: "type", params: { type: "number" }, message: "must be number" }];
                                                    return false;
                                                  }
                                                }
                                                var valid5 = _errs34 === errors2;
                                              } else {
                                                var valid5 = true;
                                              }
                                              if (valid5) {
                                                if (data8.provider !== void 0) {
                                                  let data16 = data8.provider;
                                                  const _errs36 = errors2;
                                                  if (!(data16 === "bedrock" || data16 === "firstParty" || data16 === "unknown")) {
                                                    validate272.errors = [{ instancePath: instancePath + "/models/" + i0 + "/provider", schemaPath: "#/$defs/UsageModelEstimate/properties/provider/enum", keyword: "enum", params: { allowedValues: schema41.properties.provider.enum }, message: "must be equal to one of the allowed values" }];
                                                    return false;
                                                  }
                                                  var valid5 = _errs36 === errors2;
                                                } else {
                                                  var valid5 = true;
                                                }
                                                if (valid5) {
                                                  if (data8.costBasis !== void 0) {
                                                    let data17 = data8.costBasis;
                                                    const _errs37 = errors2;
                                                    if (!(data17 === "list" || data17 === "unknown")) {
                                                      validate272.errors = [{ instancePath: instancePath + "/models/" + i0 + "/costBasis", schemaPath: "#/$defs/UsageModelEstimate/properties/costBasis/enum", keyword: "enum", params: { allowedValues: schema41.properties.costBasis.enum }, message: "must be equal to one of the allowed values" }];
                                                      return false;
                                                    }
                                                    var valid5 = _errs37 === errors2;
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
                              validate272.errors = [{ instancePath: instancePath + "/models/" + i0, schemaPath: "#/$defs/UsageModelEstimate/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                              return false;
                            }
                          }
                          var valid3 = _errs18 === errors2;
                          if (!valid3) {
                            break;
                          }
                        }
                      }
                    }
                  } else {
                    validate272.errors = [{ instancePath: instancePath + "/models", schemaPath: "#/properties/models/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                    return false;
                  }
                }
                var valid0 = _errs16 === errors2;
              } else {
                var valid0 = true;
              }
            }
          }
        }
      }
    } else {
      validate272.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate272.errors = vErrors;
  return errors2 === 0;
}
validate272.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
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
      if (data.status === void 0 && (missing0 = "status") || data.reason === void 0 && (missing0 = "reason") || data.currency === void 0 && (missing0 = "currency") || data.runDelta === void 0 && (missing0 = "runDelta") || data.cumulative === void 0 && (missing0 = "cumulative") || data.providerBilledUsd === void 0 && (missing0 = "providerBilledUsd")) {
        validate24.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "status" || key0 === "reason" || key0 === "currency" || key0 === "runDelta" || key0 === "cumulative" || key0 === "providerBilledUsd")) {
            validate24.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.status !== void 0) {
            let data0 = data.status;
            const _errs2 = errors2;
            if (!(data0 === "recorded" || data0 === "unavailable")) {
              validate24.errors = [{ instancePath: instancePath + "/status", schemaPath: "#/properties/status/enum", keyword: "enum", params: { allowedValues: schema36.properties.status.enum }, message: "must be equal to one of the allowed values" }];
              return false;
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.reason !== void 0) {
              let data1 = data.reason;
              const _errs3 = errors2;
              const _errs4 = errors2;
              let valid1 = false;
              const _errs5 = errors2;
              if (!(data1 === "configuration_mismatch" || data1 === "result_unavailable" || data1 === "baseline_mismatch" || data1 === "baseline_unavailable" || data1 === "baseline_configuration_mismatch" || data1 === "lineage_unavailable" || data1 === "counters_reset" || data1 === "estimate_mismatch" || data1 === "rates_unavailable" || data1 === "amount_out_of_range")) {
                const err0 = { instancePath: instancePath + "/reason", schemaPath: "#/properties/reason/anyOf/0/enum", keyword: "enum", params: { allowedValues: schema36.properties.reason.anyOf[0].enum }, message: "must be equal to one of the allowed values" };
                if (vErrors === null) {
                  vErrors = [err0];
                } else {
                  vErrors.push(err0);
                }
                errors2++;
              }
              var _valid0 = _errs5 === errors2;
              valid1 = valid1 || _valid0;
              const _errs6 = errors2;
              if (data1 !== null) {
                const err1 = { instancePath: instancePath + "/reason", schemaPath: "#/properties/reason/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                if (vErrors === null) {
                  vErrors = [err1];
                } else {
                  vErrors.push(err1);
                }
                errors2++;
              }
              var _valid0 = _errs6 === errors2;
              valid1 = valid1 || _valid0;
              if (!valid1) {
                const err2 = { instancePath: instancePath + "/reason", schemaPath: "#/properties/reason/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                if (vErrors === null) {
                  vErrors = [err2];
                } else {
                  vErrors.push(err2);
                }
                errors2++;
                validate24.errors = vErrors;
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
              if (data.currency !== void 0) {
                const _errs8 = errors2;
                if ("USD" !== data.currency) {
                  validate24.errors = [{ instancePath: instancePath + "/currency", schemaPath: "#/properties/currency/const", keyword: "const", params: { allowedValue: "USD" }, message: "must be equal to constant" }];
                  return false;
                }
                var valid0 = _errs8 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.runDelta !== void 0) {
                  let data3 = data.runDelta;
                  const _errs9 = errors2;
                  const _errs10 = errors2;
                  let valid2 = false;
                  const _errs11 = errors2;
                  if (!validate25(data3, { instancePath: instancePath + "/runDelta", parentData: data, parentDataProperty: "runDelta", rootData, dynamicAnchors })) {
                    vErrors = vErrors === null ? validate25.errors : vErrors.concat(validate25.errors);
                    errors2 = vErrors.length;
                  }
                  var _valid1 = _errs11 === errors2;
                  valid2 = valid2 || _valid1;
                  const _errs12 = errors2;
                  if (data3 !== null) {
                    const err3 = { instancePath: instancePath + "/runDelta", schemaPath: "#/properties/runDelta/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                    if (vErrors === null) {
                      vErrors = [err3];
                    } else {
                      vErrors.push(err3);
                    }
                    errors2++;
                  }
                  var _valid1 = _errs12 === errors2;
                  valid2 = valid2 || _valid1;
                  if (!valid2) {
                    const err4 = { instancePath: instancePath + "/runDelta", schemaPath: "#/properties/runDelta/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                    if (vErrors === null) {
                      vErrors = [err4];
                    } else {
                      vErrors.push(err4);
                    }
                    errors2++;
                    validate24.errors = vErrors;
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
                  var valid0 = _errs9 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.cumulative !== void 0) {
                    let data4 = data.cumulative;
                    const _errs14 = errors2;
                    const _errs15 = errors2;
                    let valid3 = false;
                    const _errs16 = errors2;
                    if (!validate272(data4, { instancePath: instancePath + "/cumulative", parentData: data, parentDataProperty: "cumulative", rootData, dynamicAnchors })) {
                      vErrors = vErrors === null ? validate272.errors : vErrors.concat(validate272.errors);
                      errors2 = vErrors.length;
                    }
                    var _valid2 = _errs16 === errors2;
                    valid3 = valid3 || _valid2;
                    const _errs17 = errors2;
                    if (data4 !== null) {
                      const err5 = { instancePath: instancePath + "/cumulative", schemaPath: "#/properties/cumulative/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                      if (vErrors === null) {
                        vErrors = [err5];
                      } else {
                        vErrors.push(err5);
                      }
                      errors2++;
                    }
                    var _valid2 = _errs17 === errors2;
                    valid3 = valid3 || _valid2;
                    if (!valid3) {
                      const err6 = { instancePath: instancePath + "/cumulative", schemaPath: "#/properties/cumulative/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                      if (vErrors === null) {
                        vErrors = [err6];
                      } else {
                        vErrors.push(err6);
                      }
                      errors2++;
                      validate24.errors = vErrors;
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
                  if (valid0) {
                    if (data.providerBilledUsd !== void 0) {
                      const _errs19 = errors2;
                      if (data.providerBilledUsd !== null) {
                        validate24.errors = [{ instancePath: instancePath + "/providerBilledUsd", schemaPath: "#/properties/providerBilledUsd/type", keyword: "type", params: { type: "null" }, message: "must be null" }];
                        return false;
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
      validate24.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
      return false;
    }
  }
  validate24.errors = vErrors;
  return errors2 === 0;
}
validate24.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var schema43 = { "type": "object", "properties": { "name": { "type": "string", "minLength": 1, "maxLength": 200, "pattern": "^[a-zA-Z0-9][a-zA-Z0-9_:\\-./]{0,199}$" }, "executionOutcome": { "enum": ["completed", "failed"] }, "durationMs": { "anyOf": [{ "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, { "type": "null" }] } }, "required": ["name", "executionOutcome", "durationMs"], "additionalProperties": false };
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
      if (data.coverage === void 0 && (missing0 = "coverage") || data.partial === void 0 && (missing0 = "partial") || data.omitted === void 0 && (missing0 = "omitted") || data.tools === void 0 && (missing0 = "tools")) {
        validate30.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "coverage" || key0 === "partial" || key0 === "omitted" || key0 === "tools")) {
            validate30.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.coverage !== void 0) {
            const _errs2 = errors2;
            if ("recorded-hooks-only" !== data.coverage) {
              validate30.errors = [{ instancePath: instancePath + "/coverage", schemaPath: "#/properties/coverage/const", keyword: "const", params: { allowedValue: "recorded-hooks-only" }, message: "must be equal to constant" }];
              return false;
            }
            var valid0 = _errs2 === errors2;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.partial !== void 0) {
              const _errs3 = errors2;
              if (typeof data.partial !== "boolean") {
                validate30.errors = [{ instancePath: instancePath + "/partial", schemaPath: "#/properties/partial/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                return false;
              }
              var valid0 = _errs3 === errors2;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.omitted !== void 0) {
                let data2 = data.omitted;
                const _errs5 = errors2;
                if (!(typeof data2 == "number" && (!(data2 % 1) && !isNaN(data2)) && isFinite(data2))) {
                  validate30.errors = [{ instancePath: instancePath + "/omitted", schemaPath: "#/properties/omitted/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                  return false;
                }
                if (errors2 === _errs5) {
                  if (typeof data2 == "number" && isFinite(data2)) {
                    if (data2 > 9007199254740991 || isNaN(data2)) {
                      validate30.errors = [{ instancePath: instancePath + "/omitted", schemaPath: "#/properties/omitted/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                      return false;
                    } else {
                      if (data2 < 0 || isNaN(data2)) {
                        validate30.errors = [{ instancePath: instancePath + "/omitted", schemaPath: "#/properties/omitted/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
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
                if (data.tools !== void 0) {
                  let data3 = data.tools;
                  const _errs7 = errors2;
                  if (errors2 === _errs7) {
                    if (Array.isArray(data3)) {
                      if (data3.length > 128) {
                        validate30.errors = [{ instancePath: instancePath + "/tools", schemaPath: "#/properties/tools/maxItems", keyword: "maxItems", params: { limit: 128 }, message: "must NOT have more than 128 items" }];
                        return false;
                      } else {
                        var valid1 = true;
                        const len0 = data3.length;
                        for (let i0 = 0; i0 < len0; i0++) {
                          let data4 = data3[i0];
                          const _errs9 = errors2;
                          const _errs10 = errors2;
                          if (errors2 === _errs10) {
                            if (data4 && typeof data4 == "object" && !Array.isArray(data4)) {
                              let missing1;
                              if (data4.name === void 0 && (missing1 = "name") || data4.executionOutcome === void 0 && (missing1 = "executionOutcome") || data4.durationMs === void 0 && (missing1 = "durationMs")) {
                                validate30.errors = [{ instancePath: instancePath + "/tools/" + i0, schemaPath: "#/$defs/RecordedToolOutcome/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                                return false;
                              } else {
                                const _errs12 = errors2;
                                for (const key1 in data4) {
                                  if (!(key1 === "name" || key1 === "executionOutcome" || key1 === "durationMs")) {
                                    validate30.errors = [{ instancePath: instancePath + "/tools/" + i0, schemaPath: "#/$defs/RecordedToolOutcome/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                                    return false;
                                    break;
                                  }
                                }
                                if (_errs12 === errors2) {
                                  if (data4.name !== void 0) {
                                    let data5 = data4.name;
                                    const _errs13 = errors2;
                                    if (errors2 === _errs13) {
                                      if (typeof data5 === "string") {
                                        if (func12(data5) > 200) {
                                          validate30.errors = [{ instancePath: instancePath + "/tools/" + i0 + "/name", schemaPath: "#/$defs/RecordedToolOutcome/properties/name/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" }];
                                          return false;
                                        } else {
                                          if (func12(data5) < 1) {
                                            validate30.errors = [{ instancePath: instancePath + "/tools/" + i0 + "/name", schemaPath: "#/$defs/RecordedToolOutcome/properties/name/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                            return false;
                                          } else {
                                            if (!pattern42.test(data5)) {
                                              validate30.errors = [{ instancePath: instancePath + "/tools/" + i0 + "/name", schemaPath: "#/$defs/RecordedToolOutcome/properties/name/pattern", keyword: "pattern", params: { pattern: "^[a-zA-Z0-9][a-zA-Z0-9_:\\-./]{0,199}$" }, message: 'must match pattern "^[a-zA-Z0-9][a-zA-Z0-9_:\\-./]{0,199}$"' }];
                                              return false;
                                            }
                                          }
                                        }
                                      } else {
                                        validate30.errors = [{ instancePath: instancePath + "/tools/" + i0 + "/name", schemaPath: "#/$defs/RecordedToolOutcome/properties/name/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                        return false;
                                      }
                                    }
                                    var valid3 = _errs13 === errors2;
                                  } else {
                                    var valid3 = true;
                                  }
                                  if (valid3) {
                                    if (data4.executionOutcome !== void 0) {
                                      let data6 = data4.executionOutcome;
                                      const _errs15 = errors2;
                                      if (!(data6 === "completed" || data6 === "failed")) {
                                        validate30.errors = [{ instancePath: instancePath + "/tools/" + i0 + "/executionOutcome", schemaPath: "#/$defs/RecordedToolOutcome/properties/executionOutcome/enum", keyword: "enum", params: { allowedValues: schema43.properties.executionOutcome.enum }, message: "must be equal to one of the allowed values" }];
                                        return false;
                                      }
                                      var valid3 = _errs15 === errors2;
                                    } else {
                                      var valid3 = true;
                                    }
                                    if (valid3) {
                                      if (data4.durationMs !== void 0) {
                                        let data7 = data4.durationMs;
                                        const _errs16 = errors2;
                                        const _errs17 = errors2;
                                        let valid4 = false;
                                        const _errs18 = errors2;
                                        if (!(typeof data7 == "number" && (!(data7 % 1) && !isNaN(data7)) && isFinite(data7))) {
                                          const err0 = { instancePath: instancePath + "/tools/" + i0 + "/durationMs", schemaPath: "#/$defs/RecordedToolOutcome/properties/durationMs/anyOf/0/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                          if (vErrors === null) {
                                            vErrors = [err0];
                                          } else {
                                            vErrors.push(err0);
                                          }
                                          errors2++;
                                        }
                                        if (errors2 === _errs18) {
                                          if (typeof data7 == "number" && isFinite(data7)) {
                                            if (data7 > 9007199254740991 || isNaN(data7)) {
                                              const err1 = { instancePath: instancePath + "/tools/" + i0 + "/durationMs", schemaPath: "#/$defs/RecordedToolOutcome/properties/durationMs/anyOf/0/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
                                              if (vErrors === null) {
                                                vErrors = [err1];
                                              } else {
                                                vErrors.push(err1);
                                              }
                                              errors2++;
                                            } else {
                                              if (data7 < 0 || isNaN(data7)) {
                                                const err2 = { instancePath: instancePath + "/tools/" + i0 + "/durationMs", schemaPath: "#/$defs/RecordedToolOutcome/properties/durationMs/anyOf/0/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                                if (vErrors === null) {
                                                  vErrors = [err2];
                                                } else {
                                                  vErrors.push(err2);
                                                }
                                                errors2++;
                                              }
                                            }
                                          }
                                        }
                                        var _valid0 = _errs18 === errors2;
                                        valid4 = valid4 || _valid0;
                                        const _errs20 = errors2;
                                        if (data7 !== null) {
                                          const err3 = { instancePath: instancePath + "/tools/" + i0 + "/durationMs", schemaPath: "#/$defs/RecordedToolOutcome/properties/durationMs/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                          if (vErrors === null) {
                                            vErrors = [err3];
                                          } else {
                                            vErrors.push(err3);
                                          }
                                          errors2++;
                                        }
                                        var _valid0 = _errs20 === errors2;
                                        valid4 = valid4 || _valid0;
                                        if (!valid4) {
                                          const err4 = { instancePath: instancePath + "/tools/" + i0 + "/durationMs", schemaPath: "#/$defs/RecordedToolOutcome/properties/durationMs/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                          if (vErrors === null) {
                                            vErrors = [err4];
                                          } else {
                                            vErrors.push(err4);
                                          }
                                          errors2++;
                                          validate30.errors = vErrors;
                                          return false;
                                        } else {
                                          errors2 = _errs17;
                                          if (vErrors !== null) {
                                            if (_errs17) {
                                              vErrors.length = _errs17;
                                            } else {
                                              vErrors = null;
                                            }
                                          }
                                        }
                                        var valid3 = _errs16 === errors2;
                                      } else {
                                        var valid3 = true;
                                      }
                                    }
                                  }
                                }
                              }
                            } else {
                              validate30.errors = [{ instancePath: instancePath + "/tools/" + i0, schemaPath: "#/$defs/RecordedToolOutcome/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                              return false;
                            }
                          }
                          var valid1 = _errs9 === errors2;
                          if (!valid1) {
                            break;
                          }
                        }
                      }
                    } else {
                      validate30.errors = [{ instancePath: instancePath + "/tools", schemaPath: "#/properties/tools/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
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
      if (data.schemaVersion === void 0 && (missing0 = "schemaVersion") || data.conversationId === void 0 && (missing0 = "conversationId") || data.runId === void 0 && (missing0 = "runId") || data.recording === void 0 && (missing0 = "recording") || data.usage === void 0 && (missing0 = "usage") || data.toolAudit === void 0 && (missing0 = "toolAudit")) {
        validate34.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
        return false;
      } else {
        const _errs1 = errors2;
        for (const key0 in data) {
          if (!(key0 === "schemaVersion" || key0 === "conversationId" || key0 === "runId" || key0 === "recording" || key0 === "usage" || key0 === "toolAudit")) {
            validate34.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
            return false;
            break;
          }
        }
        if (_errs1 === errors2) {
          if (data.schemaVersion !== void 0) {
            const _errs2 = errors2;
            if ("meri.conversation-usage/1" !== data.schemaVersion) {
              validate34.errors = [{ instancePath: instancePath + "/schemaVersion", schemaPath: "#/properties/schemaVersion/const", keyword: "const", params: { allowedValue: "meri.conversation-usage/1" }, message: "must be equal to constant" }];
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
                if (errors2 === _errs3) {
                  if (typeof data1 === "string") {
                    if (!formats02.test(data1)) {
                      validate34.errors = [{ instancePath: instancePath + "/conversationId", schemaPath: "#/properties/conversationId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                      return false;
                    }
                  } else {
                    validate34.errors = [{ instancePath: instancePath + "/conversationId", schemaPath: "#/properties/conversationId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
                  }
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
                  if (errors2 === _errs5) {
                    if (typeof data2 === "string") {
                      if (!formats02.test(data2)) {
                        validate34.errors = [{ instancePath: instancePath + "/runId", schemaPath: "#/properties/runId/format", keyword: "format", params: { format: "uuid" }, message: 'must match format "uuid"' }];
                        return false;
                      }
                    } else {
                      validate34.errors = [{ instancePath: instancePath + "/runId", schemaPath: "#/properties/runId/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                      return false;
                    }
                  }
                }
                var valid0 = _errs5 === errors2;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.recording !== void 0) {
                  let data3 = data.recording;
                  const _errs7 = errors2;
                  if (!(data3 === "not-recorded" || data3 === "recorded")) {
                    validate34.errors = [{ instancePath: instancePath + "/recording", schemaPath: "#/properties/recording/enum", keyword: "enum", params: { allowedValues: schema352.properties.recording.enum }, message: "must be equal to one of the allowed values" }];
                    return false;
                  }
                  var valid0 = _errs7 === errors2;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.usage !== void 0) {
                    let data4 = data.usage;
                    const _errs8 = errors2;
                    const _errs9 = errors2;
                    let valid1 = false;
                    const _errs10 = errors2;
                    if (!validate24(data4, { instancePath: instancePath + "/usage", parentData: data, parentDataProperty: "usage", rootData, dynamicAnchors })) {
                      vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
                      errors2 = vErrors.length;
                    }
                    var _valid0 = _errs10 === errors2;
                    valid1 = valid1 || _valid0;
                    const _errs11 = errors2;
                    if (data4 !== null) {
                      const err0 = { instancePath: instancePath + "/usage", schemaPath: "#/properties/usage/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                      if (vErrors === null) {
                        vErrors = [err0];
                      } else {
                        vErrors.push(err0);
                      }
                      errors2++;
                    }
                    var _valid0 = _errs11 === errors2;
                    valid1 = valid1 || _valid0;
                    if (!valid1) {
                      const err1 = { instancePath: instancePath + "/usage", schemaPath: "#/properties/usage/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                      if (vErrors === null) {
                        vErrors = [err1];
                      } else {
                        vErrors.push(err1);
                      }
                      errors2++;
                      validate34.errors = vErrors;
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
                    if (data.toolAudit !== void 0) {
                      let data5 = data.toolAudit;
                      const _errs13 = errors2;
                      const _errs14 = errors2;
                      let valid2 = false;
                      const _errs15 = errors2;
                      if (!validate30(data5, { instancePath: instancePath + "/toolAudit", parentData: data, parentDataProperty: "toolAudit", rootData, dynamicAnchors })) {
                        vErrors = vErrors === null ? validate30.errors : vErrors.concat(validate30.errors);
                        errors2 = vErrors.length;
                      }
                      var _valid1 = _errs15 === errors2;
                      valid2 = valid2 || _valid1;
                      const _errs16 = errors2;
                      if (data5 !== null) {
                        const err2 = { instancePath: instancePath + "/toolAudit", schemaPath: "#/properties/toolAudit/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                        if (vErrors === null) {
                          vErrors = [err2];
                        } else {
                          vErrors.push(err2);
                        }
                        errors2++;
                      }
                      var _valid1 = _errs16 === errors2;
                      valid2 = valid2 || _valid1;
                      if (!valid2) {
                        const err3 = { instancePath: instancePath + "/toolAudit", schemaPath: "#/properties/toolAudit/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                        if (vErrors === null) {
                          vErrors = [err3];
                        } else {
                          vErrors.push(err3);
                        }
                        errors2++;
                        validate34.errors = vErrors;
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

// conversation-history/protocol.mjs
var freeze = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
var conversationHistoryVersion = "1.4.0";
var HISTORY_PATHS = freeze({ list: "/api/conversations/list", transcript: "/api/conversations/transcript", nextTurn: "/api/conversations/next-turn", summaries: "/api/conversations/summaries", manage: "/api/conversations/manage" });
var historyDomainErrorStatuses = freeze({ CONVERSATION_REQUEST_INVALID: 400, CONVERSATION_CURSOR_INVALID: 400, CONVERSATION_NOT_FOUND: 404, CONVERSATION_TURN_CONFLICT: 409, CONVERSATION_MANAGEMENT_CONFLICT: 409, CONVERSATION_RESTORE_EXPIRED: 410, CONVERSATION_STORE_CORRUPT: 500, CONVERSATION_TURN_UNAVAILABLE: 503, CONVERSATION_UNAVAILABLE: 503 });
var historyErrorStatuses = freeze({ INVALID_REQUEST: [400], UNAUTHENTICATED: [401], ACCESS_DENIED: [403], MEMBERSHIP_REVOKED: [403], NOT_FOUND: [404], METHOD_NOT_ALLOWED: [405], DEADLINE: [408], MEMBERSHIP_CHANGED: [409], REQUEST_TOO_LARGE: [413], UNSUPPORTED_MEDIA_TYPE: [415], CANCELLED: [499], PRODUCT_UNAVAILABLE: [502], ...Object.fromEntries(Object.entries(historyDomainErrorStatuses).map(([code, status]) => [code, [status]])) });
var conversationHistoryMetadata = freeze({
  packageVersion: "0.1.15",
  historyVersion: conversationHistoryVersion,
  schemaId: "urn:meri:conversation-history:1.4.0",
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

// conversation-usage/protocol.mjs
var CONVERSATION_USAGE_SCHEMA = "meri.conversation-usage/1";
var CONVERSATION_USAGE_PATH = "/api/conversations/usage";
var usageUnavailableReasons = Object.freeze([
  "configuration_mismatch",
  "result_unavailable",
  "baseline_mismatch",
  "baseline_unavailable",
  "baseline_configuration_mismatch",
  "lineage_unavailable",
  "counters_reset",
  "estimate_mismatch",
  "rates_unavailable",
  "amount_out_of_range"
]);
var usageCounterNames = Object.freeze(["inputTokens", "outputTokens", "cacheReadInputTokens", "cacheCreationInputTokens", "webSearchRequests"]);
var conversationUsageErrors = Object.freeze({
  ...historyErrorStatuses,
  USAGE_REQUEST_INVALID: Object.freeze([400]),
  USAGE_RECORD_CORRUPT: Object.freeze([500]),
  USAGE_UNAVAILABLE: Object.freeze([503])
});
var conversationUsageMetadata = Object.freeze({
  version: "1.0.0",
  packageVersion: "0.1.15",
  schemaId: "urn:meri:conversation-usage:1.0.0",
  path: CONVERSATION_USAGE_PATH,
  method: "POST",
  requestBytes: 4096,
  responseBytes: 131072,
  maxModels: 32,
  maxTools: 128,
  authentication: "current native product bearer and Core access",
  currency: "USD",
  money: "recorded SDK estimate; provider billing unavailable",
  counters: "original token/cache-token counts and web-search request counts",
  durationUnit: "milliseconds; null means unknown",
  cumulativeScope: "SDK query pipeline including subagents/compaction and prior resumed/forked usage",
  runScope: "existing accounting run delta",
  tools: "recorded post-tool execution outcomes only; not external-effect confirmation",
  coverage: "recorded hooks only; omitted count is explicit",
  correlation: "none with UI tool.call requestId, source references or other rows",
  identifiers: "bounded inert text; never links, commands or authority"
});

// conversation-usage/semantics.mjs
var ConversationUsageResponseError = class extends Error {
  constructor(code) {
    super(code);
    this.name = "ConversationUsageResponseError";
    this.code = code;
  }
};
var fail2 = (code) => {
  throw new ConversationUsageResponseError(code);
};
function assertUsageResponseSemantics(value, request) {
  if (value.conversationId !== request.conversationId || value.runId !== request.runId) fail2("USAGE_REQUEST_MISMATCH");
  if (value.recording === "not-recorded") {
    if (value.usage !== null || value.toolAudit !== null) fail2("INVALID_USAGE_RECORDING");
    return value;
  }
  const usage = value.usage, audit = value.toolAudit;
  if (usage === null || audit === null || audit.partial !== audit.omitted > 0) fail2("INVALID_USAGE_RECORDING");
  if (usage.status === "recorded" ? usage.reason !== null || usage.runDelta === null || usage.cumulative === null : usage.reason === null) fail2("INVALID_USAGE_STATUS");
  const cumulative = usage.cumulative?.models ?? [], delta = usage.runDelta?.modelCounters ?? [];
  for (const entries of [cumulative, delta]) if (new Set(entries.map((m) => m.model)).size !== entries.length) fail2("DUPLICATE_USAGE_MODEL");
  if (usage.runDelta !== null) {
    if (usage.cumulative === null || delta.length !== cumulative.length || usage.runDelta.sdkEstimateUsd > usage.cumulative.sdkEstimateUsd + 1e-12) fail2("INVALID_USAGE_DELTA");
    for (const model of delta) {
      const original = cumulative.find((m) => m.model === model.model);
      if (!original || usageCounterNames.some((key) => model[key] > original[key])) fail2("INVALID_USAGE_DELTA");
    }
  }
  return value;
}

// conversation-usage/conversation-usage-receiver.mjs
var admitted = /* @__PURE__ */ new WeakMap();
var parse2 = (bytes, cap) => {
  try {
    return parseBytes(bytes, cap);
  } catch (error) {
    fail2(error.code ?? "INVALID_BYTES");
  }
};
function receiveConversationUsageRequest(bytes) {
  const value = parse2(bytes, conversationUsageMetadata.requestBytes);
  if (!validateRequest(value)) fail2("USAGE_REQUEST_INVALID");
  admitted.set(value, structuredClone(value));
  return value;
}
function receiveConversationUsageResponse(status, bytes, request) {
  const expected = admitted.get(request);
  if (!expected) fail2("UNADMITTED_REQUEST");
  const value = parse2(bytes, conversationUsageMetadata.responseBytes);
  if (status !== 200) {
    if (!Number.isInteger(status) || !value || Object.keys(value).length !== 1 || !value.error || Object.keys(value.error).length !== 1 || typeof value.error.code !== "string" || !Object.hasOwn(conversationUsageErrors, value.error.code) || !conversationUsageErrors[value.error.code].includes(status)) fail2("INVALID_ERROR_RESPONSE");
    return value;
  }
  if (!validateResponse(value)) fail2("INVALID_USAGE_RESPONSE");
  return assertUsageResponseSemantics(value, expected);
}
export {
  CONVERSATION_USAGE_PATH,
  CONVERSATION_USAGE_SCHEMA,
  ConversationUsageResponseError,
  USAGE_OVERVIEW_PATH,
  USAGE_OVERVIEW_SCHEMA,
  USAGE_OVERVIEW_SCHEMA_V2,
  UsageOverviewResponseError,
  conversationUsageErrors,
  conversationUsageMetadata,
  receiveConversationUsageRequest,
  receiveConversationUsageResponse,
  receiveUsageOverviewRequest,
  receiveUsageOverviewRequestV2,
  receiveUsageOverviewResponse,
  receiveUsageOverviewResponseV2,
  usageCounterNames,
  usageOverviewMetadata,
  usageOverviewMetadataV2,
  usageUnavailableReasons
};
